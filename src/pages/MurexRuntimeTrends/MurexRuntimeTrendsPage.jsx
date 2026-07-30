import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  RefreshCw,
  Search,
  TrendingUp,
  Eye,
  Pin,
  Plus,
  X,
  AlertTriangle,
  Clock,
  Activity,
  Zap,
  Calendar,
  BarChart3,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { murexService } from '@services/murexService';

import './MurexRuntimeTrendsPage.css';
import { dismissBackdrop } from '@utils/interactive';

/** Murex batch runtime trends, heatmaps and per-script health. */
export function MurexRuntimeTrendsPage() {
  useDocumentTitle('Murex Runtime Trends');

  const fetchTrends = useCallback(() => murexService.getRuntimeTrends(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchTrends);

  const runtimeSummary = data?.summary;
  const runtimeTrendData = data?.trend ?? [];
  const hourlyHeatmap = data?.hourlyHeatmap ?? [];
  const monthlyHeatmap = data?.monthlyHeatmap ?? [];

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
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const data = await murexService.getCategories();
      setRemoteCategoriesData(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setIsLoadingCategories(false);
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
  const [timeRange, setTimeRange] = useState('7d');
  // The design highlights one script in the insight panel and offers no control
  // to change it; promote to state once a selector exists.
  const selectedScript = scripts.length > 0 ? scripts[0].id : '';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [scriptFilter, setScriptFilter] = useState('');
  const [showScriptDetail, setShowScriptDetail] = useState(false);
  const [detailScript, setDetailScript] = useState(null);
  const categoryCounts = {
    ETL: scripts.filter((s) => s.category === 'ETL').length,
    Backup: scripts.filter((s) => s.category === 'Backup').length,
    'Alert Check': scripts.filter((s) => s.category === 'Alert Check').length,
    Cleanup: scripts.filter((s) => s.category === 'Cleanup').length,
    'Data Sync': scripts.filter((s) => s.category === 'Data Sync').length,
  };
  const filteredScripts = scripts
    .filter((s) => selectedCategory === 'all' || s.category === selectedCategory)
    .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  const selectedScriptData = scripts.find((s) => s.id === selectedScript);
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

  const openScriptDetail = (script) => {
    setDetailScript(script);
    setShowScriptDetail(true);
  };
  const getCategoryColor = (category) => {
    const colors = {
      ETL: '#3b82f6',
      Backup: '#10b981',
      'Alert Check': '#f59e0b',
      Cleanup: '#8b5cf6',
      'Data Sync': '#06b6d4',
    };
    return colors[category];
  };
  const getHealthColor = (health) => {
    const colors = {
      Healthy: '#10b981',
      Warning: '#f59e0b',
      Critical: '#ef4444',
    };
    return colors[health];
  };
  const getHeatmapColor = (runtime) => {
    if (runtime === 0) return '#f3f4f6';
    if (runtime < 50) return '#dbeafe';
    if (runtime < 80) return '#93c5fd';
    if (runtime < 100) return '#3b82f6';
    return '#1e40af';
  };
  const getMonthlyHeatmapColor = (executions) => {
    if (executions === 0) return '#f3f4f6';
    if (executions < 5) return '#dbeafe';
    if (executions < 10) return '#93c5fd';
    if (executions < 12) return '#3b82f6';
    return '#1e40af';
  };
  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };
  if (error) {
    return (
      <ErrorState
        title="Runtime trends could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !runtimeSummary) {
    return <Loader message="Loading runtime trends…" />;
  }

  return (
    <div className="murex-runtime-page">
      {/* Page Header */}
      <div className="murex-header">
        <div className="murex-header-left">
          <h1 className="murex-title">Murex Runtime Monitoring</h1>
          <p className="murex-subtitle">Last updated: 2026-02-03 10:30:45</p>
        </div>
        <div className="murex-header-actions">
          <button className="murex-action-btn">
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <button className="murex-action-btn">
            <Download size={12} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="murex-filter-bar">
        <div className="murex-filter-group">
          <Select
            value={scriptFilter}
            onChange={setScriptFilter}
            placeholder="All Scripts"
            options={[
              { value: '', label: 'All Scripts' },
              { value: 'ETL_PROCESS_01', label: 'ETL_PROCESS_01' },
              { value: 'BACKUP_DAILY_02', label: 'BACKUP_DAILY_02' },
              { value: 'ALERT_CHECK_03', label: 'ALERT_CHECK_03' },
            ]}
            width="project"
          />

          <div className="murex-time-toggle">
            <button
              className={`murex-time-btn ${timeRange === '7d' ? 'active' : ''}`}
              onClick={() => setTimeRange('7d')}
            >
              7d
            </button>
            <button
              className={`murex-time-btn ${timeRange === '15d' ? 'active' : ''}`}
              onClick={() => setTimeRange('15d')}
            >
              15d
            </button>
            <button
              className={`murex-time-btn ${timeRange === '30d' ? 'active' : ''}`}
              onClick={() => setTimeRange('30d')}
            >
              30d
            </button>
          </div>

          <div className="murex-threshold-inputs">
            <input type="number" placeholder="Min" className="murex-threshold-input" />
            <span className="murex-threshold-separator">–</span>
            <input type="number" placeholder="Max" className="murex-threshold-input" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="murex-tabs">
        <button
          className={`murex-tab ${activeTab === 'runtime' ? 'active' : ''}`}
          onClick={() => setActiveTab('runtime')}
        >
          Runtime Trends
        </button>
        <button
          className={`murex-tab ${activeTab === 'management' ? 'active' : ''}`}
          onClick={() => setActiveTab('management')}
        >
          Script Management
        </button>
      </div>

      {/* Tab Content */}
      <div className="murex-tab-content">
        {activeTab === 'runtime' ? (
          <div className="murex-runtime-tab">
            {/* Runtime Summary KPIs */}
            <div className="murex-kpi-row">
              <div className="murex-kpi-item">
                <div className="murex-kpi-label">Min Runtime</div>
                <div className="murex-kpi-value">{runtimeSummary.min}</div>
              </div>
              <div className="murex-kpi-divider" />
              <div className="murex-kpi-item">
                <div className="murex-kpi-label">Max Runtime</div>
                <div className="murex-kpi-value">{runtimeSummary.max}</div>
              </div>
              <div className="murex-kpi-divider" />
              <div className="murex-kpi-item">
                <div className="murex-kpi-label">Avg Runtime</div>
                <div className="murex-kpi-value">{runtimeSummary.avg}</div>
              </div>
              <div className="murex-kpi-divider" />
              <div className="murex-kpi-item">
                <div className="murex-kpi-label">Latest Run</div>
                <div className="murex-kpi-value">{runtimeSummary.latest}</div>
              </div>
              <div className="murex-kpi-divider" />
              <div className="murex-kpi-item">
                <div className="murex-kpi-label">Trend</div>
                <div className="murex-kpi-value trend-up">
                  <TrendingUp size={14} />
                  {runtimeSummary.trend}%
                </div>
              </div>
              <div className="murex-kpi-divider" />
              <div className="murex-kpi-item">
                <div className="murex-kpi-label">Outliers</div>
                <div className="murex-kpi-value outlier">{runtimeSummary.outliers}</div>
              </div>
            </div>

            {/* Main Layout: Chart + Script Insight Panel */}
            <div className="murex-runtime-layout">
              {/* Left: Runtime Chart */}
              <div className="murex-chart-section">
                <div className="murex-section-header">
                  <h3 className="murex-section-title">Runtime Trend Analysis</h3>
                </div>
                <div className="murex-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={runtimeTrendData}>
                      <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        key="xaxis"
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(date) =>
                          new Date(date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }
                      />
                      <YAxis
                        key="yaxis"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: 'Minutes',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 11 },
                        }}
                      />
                      <Tooltip
                        key="tooltip"
                        contentStyle={{ fontSize: 11, borderRadius: 6 }}
                        formatter={(value) => formatMinutes(value)}
                      />
                      <ReferenceLine
                        key="ref"
                        y={3500}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                        label={{ value: 'Threshold', position: 'right', fontSize: 10 }}
                      />
                      <Bar key="bar" dataKey="runtime" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Line
                        key="line"
                        type="monotone"
                        dataKey="average"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Script Insight Panel */}
              {selectedScriptData && (
                <div className="murex-script-insight-panel">
                  <div className="murex-insight-panel-header">
                    <div className="murex-insight-panel-title">{selectedScriptData.name}</div>
                    <span
                      className="murex-insight-health-badge"
                      style={{ background: getHealthColor(selectedScriptData.health) }}
                    >
                      {selectedScriptData.health.toUpperCase()}
                    </span>
                  </div>

                  <div className="murex-insight-panel-content">
                    <div className="murex-insight-stat-row">
                      <div className="murex-insight-stat-icon">
                        <Clock size={14} />
                      </div>
                      <div className="murex-insight-stat-info">
                        <div className="murex-insight-stat-label">Avg Runtime</div>
                        <div className="murex-insight-stat-value">
                          {selectedScriptData.avgRuntime}
                        </div>
                      </div>
                    </div>

                    <div className="murex-insight-stat-row">
                      <div className="murex-insight-stat-icon">
                        <Activity size={14} />
                      </div>
                      <div className="murex-insight-stat-info">
                        <div className="murex-insight-stat-label">Frequency</div>
                        <div className="murex-insight-stat-value">
                          {selectedScriptData.frequency} runs/day
                        </div>
                      </div>
                    </div>

                    <div className="murex-insight-stat-row">
                      <div className="murex-insight-stat-icon">
                        <Calendar size={14} />
                      </div>
                      <div className="murex-insight-stat-info">
                        <div className="murex-insight-stat-label">Last Run</div>
                        <div className="murex-insight-stat-value">{selectedScriptData.lastRun}</div>
                      </div>
                    </div>

                    <div className="murex-insight-divider" />

                    <div className="murex-insight-minmax-section">
                      <div className="murex-insight-minmax-header">
                        <span className="murex-insight-minmax-label">Min vs Max Runtime</span>
                      </div>
                      <div className="murex-insight-minmax-bar">
                        <div
                          className="murex-insight-minmax-fill"
                          style={{
                            width: `${(selectedScriptData.minRuntime / selectedScriptData.maxRuntime) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="murex-insight-minmax-values">
                        <span className="min-val">{selectedScriptData.minRuntime}m</span>
                        <span className="max-val">{selectedScriptData.maxRuntime}m</span>
                      </div>
                    </div>

                    <div className="murex-insight-divider" />

                    <div className="murex-insight-sparkline-section">
                      <div className="murex-insight-sparkline-header">
                        <BarChart3 size={12} />
                        <span className="murex-insight-sparkline-label">7-Day Trend</span>
                      </div>
                      <div className="murex-insight-sparkline-bars">
                        {selectedScriptData.trendData.map((value, i) => (
                          <div
                            key={i}
                            className="murex-insight-sparkline-bar"
                            style={{
                              height: `${(value / Math.max(...selectedScriptData.trendData)) * 100}%`,
                            }}
                            title={`Day ${i + 1}: ${value}m`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="murex-management-tab">
            {/* Left Sidebar - Categories */}
            <div className="murex-category-sidebar">
              <div className="murex-category-search">
                <Search size={12} />
                <input
                  type="text"
                  placeholder="Search category..."
                  className="murex-category-search-input"
                />
              </div>

              <div className="murex-category-list">
                <button
                  className={`murex-category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  <span className="murex-category-name">All Scripts</span>
                  <span className="murex-category-count">{scripts.length}</span>
                </button>

                {remoteCategories.map((category) => (
                  <div key={category.id} className="murex-category-item-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <button
                      className={`murex-category-item ${selectedCategory === category.name ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(category.name)}
                      style={{ borderLeft: `3px solid ${getCategoryColor(category.name) || 'var(--primary-color)'}`, flex: 1 }}
                    >
                      <span className="murex-category-name">{category.name}</span>
                      <span className="murex-category-count">
                        {scripts.filter((s) => s.category === category.name).length}
                      </span>
                    </button>
                    {category.id !== null && (
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                        <button 
                          className="murex-icon-btn" 
                          title="Edit Category"
                          onClick={(e) => handleEditCategory(category, e)}
                        >
                          <Edit size={12} />
                        </button>
                        <button 
                          className="murex-icon-btn error" 
                          title="Delete Category"
                          onClick={(e) => handleDeleteCategory(category, e)}
                          style={{ color: 'var(--error-color)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button className="murex-add-category-btn" onClick={handleAddCategory}>
                <Plus size={12} />
                <span>Add Category</span>
              </button>
            </div>

            {/* Main Script Table */}
            <div className="murex-script-table-section">
              <div className="murex-table-header">
                <div className="murex-search-wrapper">
                  <Search size={12} className="murex-search-icon" />
                  <input
                    type="text"
                    placeholder="Search scripts..."
                    className="murex-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="murex-script-table-container">
                <table className="murex-script-table">
                  <thead className="murex-script-thead">
                    <tr>
                      <th className="murex-script-th">Script Name</th>
                      <th className="murex-script-th">Category</th>
                      <th className="murex-script-th">Last Run</th>
                      <th className="murex-script-th">Avg Runtime</th>
                      <th className="murex-script-th">Status</th>
                      <th className="murex-script-th actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="murex-script-tbody">
                    {filteredScripts.map((script) => (
                      <tr
                        key={script.id}
                        className={`murex-script-row ${detailScript?.id === script.id ? 'selected' : ''}`}
                        onClick={() => openScriptDetail(script)}
                      >
                        <td className="murex-script-td">
                          <div className="murex-script-name-cell">
                            {script.isPinned && <Pin size={12} className="murex-pinned-icon" />}
                            <span>{script.name}</span>
                          </div>
                        </td>
                        <td className="murex-script-td">
                          <span
                            className="murex-category-tag"
                            style={{ background: getCategoryColor(script.category) }}
                          >
                            {script.category}
                          </span>
                        </td>
                        <td className="murex-script-td">{script.lastRun}</td>
                        <td className="murex-script-td">{script.avgRuntime}</td>
                        <td className="murex-script-td">
                          <span className={`murex-status-badge ${script.status.toLowerCase()}`}>
                            {script.status}
                          </span>
                        </td>
                        <td className="murex-script-td actions-col">
                          <div className="murex-script-actions">
                            <button
                              className="murex-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openScriptDetail(script);
                              }}
                              title="View Details"
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              className={`murex-icon-btn ${script.isPinned ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(script.id);
                              }}
                              title="Pin Script"
                            >
                              <Pin size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredScripts.length === 0 && (
                  <div className="murex-empty-state">
                    <Search size={24} />
                    <p>No scripts found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Script Detail Drawer - Enhanced Compact Design */}
      {showScriptDetail && detailScript && (
        <div
          className="murex-drawer-overlay"
          {...dismissBackdrop(() => setShowScriptDetail(false))}
        >
          <div className="murex-drawer" role="dialog" aria-modal="true">
            <div className="murex-drawer-header">
              <div className="murex-drawer-header-content">
                <h2 className="murex-drawer-title">{detailScript.name}</h2>
                <div className="murex-drawer-meta">
                  <span
                    className="murex-drawer-category-tag"
                    style={{ background: getCategoryColor(detailScript.category) }}
                  >
                    {detailScript.category}
                  </span>
                  <span
                    className="murex-drawer-health-badge"
                    style={{ background: getHealthColor(detailScript.health) }}
                  >
                    {detailScript.health}
                  </span>
                </div>
              </div>
              <button className="murex-drawer-close" onClick={() => setShowScriptDetail(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="murex-drawer-content">
              {/* Quick Stats Grid */}
              <div className="murex-drawer-stats-grid">
                <div className="murex-drawer-stat-card">
                  <div className="murex-drawer-stat-icon">
                    <Clock size={14} />
                  </div>
                  <div className="murex-drawer-stat-content">
                    <div className="murex-drawer-stat-label">Avg Runtime</div>
                    <div className="murex-drawer-stat-value">{detailScript.avgRuntime}</div>
                  </div>
                </div>

                <div className="murex-drawer-stat-card">
                  <div className="murex-drawer-stat-icon">
                    <Activity size={14} />
                  </div>
                  <div className="murex-drawer-stat-content">
                    <div className="murex-drawer-stat-label">Frequency</div>
                    <div className="murex-drawer-stat-value">{detailScript.frequency}/day</div>
                  </div>
                </div>

                <div className="murex-drawer-stat-card">
                  <div className="murex-drawer-stat-icon">
                    <Zap size={14} />
                  </div>
                  <div className="murex-drawer-stat-content">
                    <div className="murex-drawer-stat-label">Min Runtime</div>
                    <div className="murex-drawer-stat-value">{detailScript.minRuntime}m</div>
                  </div>
                </div>

                <div className="murex-drawer-stat-card">
                  <div className="murex-drawer-stat-icon">
                    <AlertTriangle size={14} />
                  </div>
                  <div className="murex-drawer-stat-content">
                    <div className="murex-drawer-stat-label">Max Runtime</div>
                    <div className="murex-drawer-stat-value">{detailScript.maxRuntime}m</div>
                  </div>
                </div>
              </div>

              {/* Hourly Heatmap - Day vs Hour */}
              <div className="murex-drawer-section">
                <h3 className="murex-drawer-section-title">Execution Pattern (Hour vs Day)</h3>
                <div className="murex-drawer-heatmap-container">
                  <div className="murex-drawer-heatmap-y-axis">
                    <div className="murex-drawer-heatmap-y-label">00</div>
                    <div className="murex-drawer-heatmap-y-label">04</div>
                    <div className="murex-drawer-heatmap-y-label">08</div>
                    <div className="murex-drawer-heatmap-y-label">12</div>
                    <div className="murex-drawer-heatmap-y-label">16</div>
                    <div className="murex-drawer-heatmap-y-label">20</div>
                  </div>
                  <div className="murex-drawer-heatmap-content">
                    <div className="murex-drawer-heatmap-x-axis">
                      <div className="murex-drawer-heatmap-x-label">Mon</div>
                      <div className="murex-drawer-heatmap-x-label">Tue</div>
                      <div className="murex-drawer-heatmap-x-label">Wed</div>
                      <div className="murex-drawer-heatmap-x-label">Thu</div>
                      <div className="murex-drawer-heatmap-x-label">Fri</div>
                      <div className="murex-drawer-heatmap-x-label">Sat</div>
                      <div className="murex-drawer-heatmap-x-label">Sun</div>
                    </div>
                    <div className="murex-drawer-heatmap-grid">
                      {hourlyHeatmap.map((cell, i) => (
                        <div
                          key={i}
                          className="murex-drawer-heatmap-cell"
                          style={{ background: getHeatmapColor(cell.runtime) }}
                          title={`${cell.day} ${cell.hour}:00 - ${cell.runtime}m`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="murex-drawer-heatmap-legend">
                  <span className="murex-drawer-legend-label">No Run</span>
                  <div className="murex-drawer-legend-gradient" />
                  <span className="murex-drawer-legend-label">Peak</span>
                </div>
              </div>

              {/* Monthly Heatmap */}
              <div className="murex-drawer-section">
                <h3 className="murex-drawer-section-title">February 2026 Execution Calendar</h3>
                <div className="murex-drawer-monthly-grid">
                  {monthlyHeatmap.map((day, i) => (
                    <div
                      key={i}
                      className="murex-drawer-monthly-cell"
                      style={{ background: getMonthlyHeatmapColor(day.executions) }}
                      title={`${day.date} (${day.dayOfWeek}) - ${day.executions} runs, Avg: ${day.avgRuntime}m`}
                    >
                      <div className="murex-drawer-monthly-date">{day.date.split(' ')[1]}</div>
                      <div className="murex-drawer-monthly-day">
                        {day.dayOfWeek.substring(0, 1)}
                      </div>
                      <div className="murex-drawer-monthly-count">{day.executions}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Statistics */}
              <div className="murex-drawer-section">
                <h3 className="murex-drawer-section-title">Performance Metrics</h3>
                <div className="murex-drawer-metrics-grid">
                  <div className="murex-drawer-metric-item">
                    <span className="murex-drawer-metric-label">Total Executions</span>
                    <span className="murex-drawer-metric-value">{detailScript.totalExecutions || 0}</span>
                  </div>
                  <div className="murex-drawer-metric-item">
                    <span className="murex-drawer-metric-label">Success Rate</span>
                    <span className="murex-drawer-metric-value success">{detailScript.successRate || 0}%</span>
                  </div>
                  <div className="murex-drawer-metric-item">
                    <span className="murex-drawer-metric-label">Failed Runs</span>
                    <span className="murex-drawer-metric-value error">{detailScript.failedRuns || 0}</span>
                  </div>
                  <div className="murex-drawer-metric-item">
                    <span className="murex-drawer-metric-label">Avg Duration</span>
                    <span className="murex-drawer-metric-value">{detailScript.avgRuntime}</span>
                  </div>
                  <div className="murex-drawer-metric-item">
                    <span className="murex-drawer-metric-label">Fastest Run</span>
                    <span className="murex-drawer-metric-value">{detailScript.minRuntime}m</span>
                  </div>
                  <div className="murex-drawer-metric-item">
                    <span className="murex-drawer-metric-label">Slowest Run</span>
                    <span className="murex-drawer-metric-value warning">
                      {detailScript.maxRuntime}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Timeline */}
              <div className="murex-drawer-section">
                <h3 className="murex-drawer-section-title">Recent Activity</h3>
                <div className="murex-drawer-activity-list">
                  {(detailScript.history || []).map((historyItem, index) => (
                    <div key={index} className="murex-drawer-activity-item">
                      <div className={`murex-drawer-activity-dot ${historyItem.status}`} />
                      <div className="murex-drawer-activity-content">
                        <div className="murex-drawer-activity-header">
                          <span className="murex-drawer-activity-title">{historyItem.title}</span>
                          <span className={`murex-drawer-activity-duration ${historyItem.status}`}>
                            {historyItem.durationFormatted}
                          </span>
                        </div>
                        <div className="murex-drawer-activity-time">{historyItem.date}</div>
                        {historyItem.steps && historyItem.steps.length > 0 && (
                          <div className="murex-drawer-activity-steps">
                            {historyItem.steps.map((step, sIdx) => (
                               <div key={sIdx} className="murex-step-detail">
                                 <span className="murex-step-name">{step.name}</span>
                                 <span className="murex-step-metrics">
                                   CPU: {step.cpu_time}ms | DB: {step.db_time}ms | Elapsed: {step.elapsed_time}ms
                                 </span>
                               </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!detailScript.history || detailScript.history.length === 0) && (
                     <div className="murex-empty-state" style={{ padding: '20px 0' }}>
                       <p>No recent activity data available.</p>
                     </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Category Management Modal */}
      <AdminModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? 'Edit Category' : 'Create a New Category'}
        size={editingCategory ? 'lg' : 'md'}
        footer={
          <>
            <button className="con-drawer-btn-cancel" onClick={() => setShowCategoryModal(false)}>
              Cancel
            </button>
            <button className="con-drawer-btn-save" onClick={handleSaveCategory}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </>
        }
      >
        <div className="murex-category-form-grid" style={{ display: 'grid', gridTemplateColumns: editingCategory ? '1fr 1fr' : '1fr', gap: '20px' }}>
          <div className="murex-form-group">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Category Name *</label>
            <input 
              type="text" 
              value={categoryFormName} 
              onChange={e => setCategoryFormName(e.target.value)} 
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} 
            />
          </div>
          <div className="murex-form-group">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Description</label>
            <textarea 
              value={categoryFormDescription} 
              onChange={e => setCategoryFormDescription(e.target.value)} 
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'vertical', minHeight: '80px' }} 
            />
          </div>
        </div>

        {editingCategory && (
          <div className="murex-dual-list-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
            {/* Available Scripts */}
            <div className="murex-script-list-pane">
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)' }}>Available Scripts ({renderedAvailableScripts.length})</h4>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Search available scripts..." 
                  value={availableSearch}
                  onChange={(e) => setAvailableSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 8px 8px 30px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="murex-script-list-scroll" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', height: '250px', overflowY: 'auto', padding: '8px' }}>
                {renderedAvailableScripts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px' }}>No scripts found</div>
                ) : (
                  renderedAvailableScripts.map(script => (
                    <div key={script.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      <span>{script.script_name}</span>
                      <button onClick={() => toggleScriptAssignment(script.script_name, true)} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Category Scripts */}
            <div className="murex-script-list-pane">
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)' }}>Category Scripts ({renderedAssignedScripts.length})</h4>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Search category scripts..." 
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 8px 8px 30px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="murex-script-list-scroll" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', height: '250px', overflowY: 'auto', padding: '8px', background: 'var(--bg-tertiary)' }}>
                {renderedAssignedScripts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px' }}>No scripts assigned</div>
                ) : (
                  renderedAssignedScripts.map(script => (
                    <div key={script.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-primary)', borderRadius: '4px', marginBottom: '4px' }}>
                      <span>{script.script_name}</span>
                      <button onClick={() => toggleScriptAssignment(script.script_name, false)} style={{ background: 'var(--error-color)', color: 'white', border: 'none', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>-</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </AdminModal>
      
      {/* Delete Confirmation Modal */}
      <AdminModal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        title=""
        size="sm"
        footer={
          <div style={{ display: 'flex', width: '100%', justifyContent: 'center', gap: '10px' }}>
            <button className="con-drawer-btn-cancel" onClick={() => setDeletingCategory(null)}>
              Cancel
            </button>
            <button className="con-drawer-btn-save danger" onClick={confirmDeleteCategory}>
              Delete
            </button>
          </div>
        }
      >
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: '#f59e0b' }}>
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Confirm Deletion</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Are you sure you want to delete the category<br />
            <strong>{deletingCategory?.name}</strong>?
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            All scripts within this category will become uncategorized.
          </p>
        </div>
      </AdminModal>
    </div>
  );
}
export default MurexRuntimeTrendsPage;
