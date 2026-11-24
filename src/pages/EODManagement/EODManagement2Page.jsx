import { useDocumentTitle } from '@hooks/useDocumentTitle';

import { SchedulerTab } from './scheduler/SchedulerTab';

import './EODManagementPage.css';

/** EOD Management 2: the Control-M style scheduler (workflow, runs, schedule, target servers, settings) per environment. */
export function EODManagement2Page() {
  useDocumentTitle('EOD Management 2');

  return (
    <div className="eod-page">
      <SchedulerTab />
    </div>
  );
}

export default EODManagement2Page;
