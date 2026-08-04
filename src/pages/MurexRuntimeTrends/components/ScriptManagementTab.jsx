import { Fragment } from 'react';
import { Activity, ChevronDown, ChevronUp, Edit, Eye, Pin, Plus, Search, Trash2 } from 'lucide-react';

import { getCategoryColor, getScriptHeatmapSpec } from '../utils';
import { PlotlyChart } from './PlotlyChart';

export function ScriptManagementTab({
  scripts,
  filteredScripts,
  remoteCategories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  expandedScriptIds,
  toggleExpandScript,
  togglePin,
  onHeatmapCellClick,
}) {
  return (
    <div className="murex-management-tab">
      {/* Left Sidebar - Categories */}
      <div className="murex-category-sidebar">
        <div className="murex-category-search">
          <Search size={12} />
          <input type="text" placeholder="Search category..." className="murex-category-search-input" />
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
                  <button className="murex-icon-btn" title="Edit Category" onClick={(e) => onEditCategory(category, e)}>
                    <Edit size={12} />
                  </button>
                  <button
                    className="murex-icon-btn error"
                    title="Delete Category"
                    onClick={(e) => onDeleteCategory(category, e)}
                    style={{ color: 'var(--error-color)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <button className="murex-add-category-btn" onClick={onAddCategory}>
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
              {filteredScripts.map((script) => {
                const isExpanded = expandedScriptIds.has(script.id);
                const spec = getScriptHeatmapSpec(script);
                return (
                  <Fragment key={script.id}>
                    <tr
                      className={`murex-script-row ${isExpanded ? 'expanded' : ''}`}
                      onClick={(e) => toggleExpandScript(script.id, e)}
                    >
                      <td className="murex-script-td">
                        <div className="murex-script-name-cell">
                          {script.isPinned && <Pin size={12} className="murex-pinned-icon" />}
                          <span>{script.name}</span>
                        </div>
                      </td>
                      <td className="murex-script-td">
                        <span className="murex-category-tag" style={{ background: getCategoryColor(script.category) }}>
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
                            className={`murex-icon-btn ${isExpanded ? 'active' : ''}`}
                            onClick={(e) => toggleExpandScript(script.id, e)}
                            title={isExpanded ? 'Collapse Details' : 'Expand Details & Heatmap'}
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <Eye size={12} />}
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

                    {isExpanded && (
                      <tr className="murex-script-detail-row">
                        <td colSpan={6}>
                          <div className="murex-detail-accordion-content">
                            <div className="murex-detail-accordion-header">
                              <h4 className="murex-detail-title">
                                <Activity size={14} style={{ color: '#005A36' }} />
                                Runtime Heatmap & Execution Pattern — {script.name}
                              </h4>
                              <span className="murex-detail-subtitle">
                                Click any date cell on the heatmap to view detailed execution runs & Gantt charts
                              </span>
                            </div>

                            <div className="murex-detail-heatmap-wrapper">
                              <PlotlyChart
                                data={spec.data}
                                layout={spec.layout}
                                onClick={(e) => onHeatmapCellClick(script, e)}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
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
  );
}

export default ScriptManagementTab;
