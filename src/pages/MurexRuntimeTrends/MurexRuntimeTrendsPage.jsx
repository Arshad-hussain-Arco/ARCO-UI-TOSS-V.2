import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { CardGridSkeleton } from '@components/feedback/Skeleton';
import { Tabs } from '@components/common';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { murexService } from '@services/murexService';
import { parseISO, getISOWeek, getDay } from 'date-fns';

import { getCellExecutionDetails } from './utils';
import { RuntimeTrendsTab } from './components/RuntimeTrendsTab';
import { ScriptManagementTab } from './components/ScriptManagementTab';
import { JobExecutionDetailsModal } from './components/JobExecutionDetailsModal';
import { CategoryFormModal } from './components/CategoryFormModal';
import { DeleteCategoryModal } from './components/DeleteCategoryModal';

import './MurexRuntimeTrendsPage.css';

/** Murex batch runtime trends, heatmaps and per-script health. */
export function MurexRuntimeTrendsPage() {
  useDocumentTitle('Murex Runtime Trends');

  const fetchTrends = useCallback(() => murexService.getRuntimeTrends(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchTrends);

  const runtimeSummary = data?.summary;

  /**
   * Pinning is a client-side preference layered over the loaded scripts, so it
   * survives a refetch without the service needing to persist it.
   */
  const [pinnedScriptIds, setPinnedScriptIds] = useState(() => new Set());

  // Category Management State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormDescription, setCategoryFormDescription] = useState('');
  const [categoryFormScripts, setCategoryFormScripts] = useState([]); // Array of script names
  const [availableSearch, setAvailableSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  const [remoteCategoriesData, setRemoteCategoriesData] = useState([]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await murexService.getCategories();
      setRemoteCategoriesData(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const remoteCategories = Array.isArray(remoteCategoriesData) ? remoteCategoriesData : [];
  const scripts = useMemo(
    () =>
      (data?.scripts ?? []).map((script) => {
        // Find explicit remote category that contains this script
        const matchingCategory = remoteCategories.find(c =>
          c.scripts && c.scripts.some(s => s.script_name === script.name)
        );
        return {
          ...script,
          category: matchingCategory ? matchingCategory.name : 'Unassigned Scripts',
          isPinned: pinnedScriptIds.has(script.id),
        };
      }),
    [data, pinnedScriptIds, remoteCategories],
  );

  const [activeTab, setActiveTab] = useState('runtime');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedScriptIds, setExpandedScriptIds] = useState(() => new Set());
  const [selectedCellDetails, setSelectedCellDetails] = useState(null);
  const [expandedRunGanttIds, setExpandedRunGanttIds] = useState(() => new Set());
  const [isGanttLoading, setIsGanttLoading] = useState(false);

  const toggleExpandScript = (scriptId, e) => {
    e?.stopPropagation();
    setExpandedScriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(scriptId)) next.delete(scriptId);
      else next.add(scriptId);
      return next;
    });
  };

  const toggleRunGantt = (runId) => {
    setExpandedRunGanttIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const handleHeatmapCellClick = async (script, eventData) => {
    if (eventData?.points?.[0]) {
      const pt = eventData.points[0];
      const details = getCellExecutionDetails(script, pt.x, pt.y);
      setSelectedCellDetails(details);
      setExpandedRunGanttIds(new Set());
      setIsGanttLoading(true);

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const ptDayIndex = days.indexOf(pt.y);
      const ptWeek = parseInt(pt.x, 10);

      const matchingRun = (script.history || []).find(run => {
        if (!run.date || run.date === 'Unknown Date') return false;
        const dateObj = parseISO(run.date);
        if (isNaN(dateObj)) return false;
        const week = getISOWeek(dateObj);
        const jsDay = getDay(dateObj);
        const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
        return week === ptWeek && dayIndex === ptDayIndex;
      });

      if (matchingRun) {
        const payload = { script_name: script.name, label: matchingRun.date };
        try {
          const response = await murexService.fetchRuntimeDetails(payload);
          const processData = response.data?.[script.name];
          if (processData && processData.labels && processData.steps) {
            const runs = processData.labels.map((label, index) => {
              const stepsData = processData.steps[index];
              const formatDuration = (secs) => {
                const h = Math.floor(secs / 3600).toString().padStart(2, '0');
                const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
                const s = Math.floor(secs % 60).toString().padStart(2, '0');
                return `${h}:${m}:${s}`;
              };

              return {
                id: `${script.id}-run-${index}`,
                name: `Run ${index + 1} (${label})`,
                duration: formatDuration(processData.time_duration[index]),
                seconds: processData.time_duration[index],
                isOutlier: false,
                steps: stepsData.step.map((stepName, stepIndex) => ({
                  name: stepName,
                  dbTime: stepsData.db_time[stepIndex],
                  cpuTime: stepsData.cpu_time[stepIndex],
                  elapsed: stepsData.elapsed_time[stepIndex],
                }))
              };
            });

            setSelectedCellDetails({
              ...details,
              date: matchingRun.date,
              totalRuns: runs.length,
              avgDuration: runs.length > 0
                ? new Date((runs.reduce((acc, r) => acc + r.seconds, 0) / runs.length) * 1000).toISOString().substr(11, 8)
                : '00:00:00',
              outliersCount: runs.filter(r => r.isOutlier).length,
              runs: runs
            });
          }
        } catch (err) {
          console.error("Failed to fetch exact run details:", err);
        } finally {
          setIsGanttLoading(false);
        }
      } else {
        setIsGanttLoading(false);
      }
    }
  };

  const filteredScripts = scripts
    .filter((s) => selectedCategory === 'all' || s.category === selectedCategory)
    .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  const togglePin = (scriptId) => {
    setPinnedScriptIds((current) => {
      const next = new Set(current);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormName('');
    setCategoryFormDescription('');
    setCategoryFormScripts([]);
    setAvailableSearch('');
    setCategorySearch('');
    setShowCategoryModal(true);
  };

  const handleEditCategory = (cat, e) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCategoryFormName(cat.name);
    setCategoryFormDescription(cat.description || '');
    setCategoryFormScripts((cat.scripts || []).map(s => s.script_name));
    setAvailableSearch('');
    setCategorySearch('');
    setShowCategoryModal(true);
  };

  const allKnownScripts = useMemo(() => {
    const unassigned = remoteCategories.find(c => c.id === null)?.scripts || [];
    const currentCatScripts = editingCategory?.scripts || [];
    return [...unassigned, ...currentCatScripts];
  }, [remoteCategories, editingCategory]);

  const renderedAvailableScripts = allKnownScripts
    .filter(s => !categoryFormScripts.includes(s.script_name))
    .filter(s => s.script_name.toLowerCase().includes(availableSearch.toLowerCase()));

  const renderedAssignedScripts = allKnownScripts
    .filter(s => categoryFormScripts.includes(s.script_name))
    .filter(s => s.script_name.toLowerCase().includes(categorySearch.toLowerCase()));

  const toggleScriptAssignment = (scriptName, assign) => {
    if (assign) {
      setCategoryFormScripts(prev => [...prev, scriptName]);
    } else {
      setCategoryFormScripts(prev => prev.filter(name => name !== scriptName));
    }
  };

  const [deletingCategory, setDeletingCategory] = useState(null);

  const handleDeleteCategory = (cat, e) => {
    e.stopPropagation();
    setDeletingCategory(cat);
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      const res = await murexService.deleteCategory(deletingCategory.id);
      if (res?.categories) {
        setRemoteCategoriesData(res.categories);
      } else {
        fetchCategories();
      }
      if (selectedCategory === deletingCategory.name) {
        setSelectedCategory('all');
      }
    } catch (err) {
      console.error('Failed to delete category', err);
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormName.trim()) return;
    try {
      const originalScripts = (editingCategory?.scripts || []).map(s => s.script_name);

      const payload = {
        name: categoryFormName.trim(),
        description: categoryFormDescription.trim(),
        assign_scripts: categoryFormScripts.filter(name => !originalScripts.includes(name)),
        unassign_scripts: originalScripts.filter(name => !categoryFormScripts.includes(name))
      };

      let res;
      if (editingCategory) {
        res = await murexService.updateCategory(editingCategory.id, payload);
      } else {
        res = await murexService.createCategory(payload);
      }

      if (res?.categories) {
        setRemoteCategoriesData(res.categories);
      } else {
        fetchCategories();
      }
      setShowCategoryModal(false);
    } catch (err) {
      console.error('Failed to save category', err);
    }
  };

  const openScriptDetail = () => {
    // Reserved for a future "script detail" drawer; currently detail is opened via heatmap cell clicks.
  };

  if (error) {
    return <ErrorState title="Runtime trends could not be loaded" description={error.message} onRetry={refetch} />;
  }

  if (isLoading || !runtimeSummary) {
    return (
      <div className="murex-runtime-page">
        <CardGridSkeleton count={3} minWidth={320} lines={3} />
      </div>
    );
  }

  return (
    <div className="murex-runtime-page">
      <Tabs
        tabs={[
          { id: 'runtime', label: 'Runtime Trends' },
          { id: 'management', label: 'Script Management' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="murex-tab-content">
        {activeTab === 'runtime' ? (
          <RuntimeTrendsTab scripts={scripts} onOpenDetail={openScriptDetail} />
        ) : (
          <ScriptManagementTab
            scripts={scripts}
            filteredScripts={filteredScripts}
            remoteCategories={remoteCategories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onAddCategory={handleAddCategory}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            expandedScriptIds={expandedScriptIds}
            toggleExpandScript={toggleExpandScript}
            togglePin={togglePin}
            onHeatmapCellClick={handleHeatmapCellClick}
          />
        )}
      </div>

      <JobExecutionDetailsModal
        selectedCellDetails={selectedCellDetails}
        onClose={() => setSelectedCellDetails(null)}
        isGanttLoading={isGanttLoading}
        expandedRunGanttIds={expandedRunGanttIds}
        toggleRunGantt={toggleRunGantt}
      />

      <CategoryFormModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        editingCategory={editingCategory}
        categoryFormName={categoryFormName}
        setCategoryFormName={setCategoryFormName}
        categoryFormDescription={categoryFormDescription}
        setCategoryFormDescription={setCategoryFormDescription}
        availableSearch={availableSearch}
        setAvailableSearch={setAvailableSearch}
        categorySearch={categorySearch}
        setCategorySearch={setCategorySearch}
        renderedAvailableScripts={renderedAvailableScripts}
        renderedAssignedScripts={renderedAssignedScripts}
        toggleScriptAssignment={toggleScriptAssignment}
        onSave={handleSaveCategory}
      />

      <DeleteCategoryModal
        category={deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={confirmDeleteCategory}
      />
    </div>
  );
}

export default MurexRuntimeTrendsPage;
