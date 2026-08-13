/**
 * Mock dataset for Murex Overview tab charts:
 * 1. Job - Duration Matrix
 * 2. MO_EOD Job Timeline
 * Ready for future API response substitution.
 */

export const mockJobDurationMatrixData = {
  header: {
    title: 'Job - Duration Matrix',
    subtitle: '24-Hour Overview Window',
    date: '2026-07-12',
  },
  jobs: [
    {
      id: 'job_1',
      name: 'job-1',
      unit: 'BATCH_JOB_1',
      start: '2026-07-12 00:45:00',
      end: '2026-07-12 02:15:00',
      startTimeStr: '0:45',
      endTimeStr: '2:15',
      durationSec: 5400,
      durationStr: '1hr 30mins',
    },
    {
      id: 'job_2',
      name: 'job-2',
      unit: 'BATCH_JOB_2',
      start: '2026-07-12 02:00:00',
      end: '2026-07-12 05:30:00',
      startTimeStr: '2:00',
      endTimeStr: '5:30',
      durationSec: 12600,
      durationStr: '3hr 30mins',
    },
    {
      id: 'job_3',
      name: 'job-3',
      unit: 'BATCH_JOB_3',
      start: '2026-07-12 01:00:00',
      end: '2026-07-12 08:00:00',
      startTimeStr: '1:00',
      endTimeStr: '8:00',
      durationSec: 25200,
      durationStr: '7hrs',
    },
    {
      id: 'job_4',
      name: 'job-4',
      unit: 'BATCH_JOB_4',
      start: '2026-07-12 06:00:00',
      end: '2026-07-12 14:00:00',
      startTimeStr: '6:00',
      endTimeStr: '14:00',
      durationSec: 28800,
      durationStr: '8hrs',
    },
  ],
};

export const mockOverviewTimelineData = {
  jobInfo: {
    title: 'MO_EOD Job Timeline',
    startTimeStr: '12-JUL-2026 23:25:42',
    endTimeStr: '13-JUL-2026 00:55:40',
    durationStr: '1h 29m 58s',
    baseDate: '2026-07-12',
  },
  categories: [
    { key: 'overall', name: 'Overall Job', color: '#3B82F6' },
    { key: 'cpu', name: 'Time_CPU', color: '#EC4899' },
    { key: 'syb', name: 'Time_Syb', color: '#00B4D8' },
    { key: 'idle', name: 'Idle / Wait', color: '#CBD5E1' },
  ],
  // Script rows in order from top to bottom
  rows: [
    {
      id: 'overall',
      name: 'EOD JOB (overall)',
      unit: 'MO_EOD_JOB_OVERALL',
      segments: [
        {
          type: 'overall',
          typeName: 'Overall Job',
          start: '2026-07-12 23:25:42',
          end: '2026-07-13 00:55:40',
          durationSec: 5398,
          durationFormatted: '1h 29m 58s',
        },
      ],
    },
    {
      id: 'init_check',
      name: 'init check',
      unit: 'SYS_INIT_CHECK',
      segments: [],
    },
    {
      id: 'feed_1',
      name: 'FEED #1 (3558-3661)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:25:42',
          end: '2026-07-12 23:31:00',
          durationSec: 318,
          durationFormatted: '5m 18s',
        },
        {
          type: 'cpu',
          typeName: 'Time_CPU',
          start: '2026-07-12 23:31:00',
          end: '2026-07-12 23:33:00',
          durationSec: 120,
          durationFormatted: '00:02:00',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:33:00',
          end: '2026-07-12 23:36:00',
          durationSec: 180,
          durationFormatted: '00:03:00',
        },
      ],
    },
    {
      id: 'feed_2',
      name: 'FEED #2 (3662-3677)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:30:00',
          end: '2026-07-12 23:37:53',
          durationSec: 473,
          durationFormatted: '7m 53s',
        },
        {
          type: 'cpu',
          typeName: 'Time_CPU',
          start: '2026-07-12 23:37:53',
          end: '2026-07-12 23:38:40',
          durationSec: 47,
          durationFormatted: '00:00:47',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:38:40',
          end: '2026-07-12 23:45:24',
          durationSec: 404,
          durationFormatted: '00:06:44',
        },
      ],
    },
    {
      id: 'feed_3',
      name: 'FEED #3 (3678-3679)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:38:00',
          end: '2026-07-12 23:38:45',
          durationSec: 45,
          durationFormatted: '00:00:45',
        },
      ],
    },
    {
      id: 'feed_4',
      name: 'FEED #4 (3680-3685)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:37:30',
          end: '2026-07-12 23:38:40',
          durationSec: 70,
          durationFormatted: '1m 10s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:38:40',
          end: '2026-07-12 23:40:00',
          durationSec: 80,
          durationFormatted: '00:01:20',
        },
      ],
    },
    {
      id: 'feed_5',
      name: 'FEED #5 (3686-3691)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:39:00',
          end: '2026-07-12 23:39:40',
          durationSec: 40,
          durationFormatted: '00:00:40',
        },
      ],
    },
    {
      id: 'feed_6',
      name: 'FEED #6 (3692-3693)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:38:30',
          end: '2026-07-12 23:40:10',
          durationSec: 100,
          durationFormatted: '1m 40s',
        },
        {
          type: 'cpu',
          typeName: 'Time_CPU',
          start: '2026-07-12 23:40:10',
          end: '2026-07-12 23:40:40',
          durationSec: 30,
          durationFormatted: '00:00:30',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:40:40',
          end: '2026-07-12 23:42:00',
          durationSec: 80,
          durationFormatted: '00:01:20',
        },
      ],
    },
    {
      id: 'feed_7',
      name: 'FEED #7 (3694-3697)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:41:00',
          end: '2026-07-12 23:41:30',
          durationSec: 30,
          durationFormatted: '00:00:30',
        },
      ],
    },
    {
      id: 'proc_1',
      name: 'PROC #1 (3698-3721)',
      unit: 'REP_BATCHES_PROC',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:40:00',
          end: '2026-07-12 23:51:30',
          durationSec: 690,
          durationFormatted: '11m 30s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:51:30',
          end: '2026-07-13 00:04:00',
          durationSec: 750,
          durationFormatted: '00:12:30',
        },
      ],
    },
    {
      id: 'feed_8',
      name: 'FEED #8 (3722-3753)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:51:30',
          end: '2026-07-12 23:56:30',
          durationSec: 300,
          durationFormatted: '5m 00s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:56:30',
          end: '2026-07-13 00:01:30',
          durationSec: 300,
          durationFormatted: '00:05:00',
        },
      ],
    },
    {
      id: 'feed_9',
      name: 'FEED #9 (3754-3763)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:55:00',
          end: '2026-07-12 23:58:00',
          durationSec: 180,
          durationFormatted: '3m 00s',
        },
        {
          type: 'cpu',
          typeName: 'Time_CPU',
          start: '2026-07-12 23:58:00',
          end: '2026-07-12 23:58:45',
          durationSec: 45,
          durationFormatted: '00:00:45',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:58:45',
          end: '2026-07-13 00:01:45',
          durationSec: 180,
          durationFormatted: '00:03:00',
        },
      ],
    },
    {
      id: 'feed_10',
      name: 'FEED #10 (3764-3765)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:58:30',
          end: '2026-07-12 23:59:40',
          durationSec: 70,
          durationFormatted: '1m 10s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 23:59:40',
          end: '2026-07-13 00:00:50',
          durationSec: 70,
          durationFormatted: '00:01:10',
        },
      ],
    },
    {
      id: 'feed_11',
      name: 'FEED #11 (3770-3799)',
      unit: 'REP_BATCHES_FEED',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 23:59:00',
          end: '2026-07-13 00:11:30',
          durationSec: 750,
          durationFormatted: '12m 30s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-13 00:11:30',
          end: '2026-07-13 00:23:00',
          durationSec: 690,
          durationFormatted: '00:11:30',
        },
      ],
    },
    {
      id: 'final_step',
      name: 'final step (3800)',
      unit: 'REP_BATCHES_FINAL',
      segments: [
        {
          type: 'cpu',
          typeName: 'Time_CPU',
          start: '2026-07-13 00:11:30',
          end: '2026-07-13 00:15:30',
          durationSec: 240,
          durationFormatted: '00:04:00',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-13 00:15:30',
          end: '2026-07-13 00:55:40',
          durationSec: 2410,
          durationFormatted: '00:40:10',
        },
      ],
    },
  ],
};

export const mockFOOverviewTimelineData = {
  id: 'fo_eod',
  jobInfo: {
    title: 'FO_EOD Job Timeline',
    startTimeStr: '12-JUL-2026 21:15:00',
    endTimeStr: '12-JUL-2026 23:10:15',
    durationStr: '1h 55m 15s',
    baseDate: '2026-07-12',
    xRange: ['2026-07-12 21:10:00', '2026-07-12 23:15:00'],
  },
  categories: [
    { key: 'overall', name: 'Overall Job', color: '#3B82F6' },
    { key: 'cpu', name: 'Time_CPU', color: '#EC4899' },
    { key: 'syb', name: 'Time_Syb', color: '#00B4D8' },
    { key: 'idle', name: 'Idle / Wait', color: '#CBD5E1' },
  ],
  rows: [
    {
      id: 'fo_overall',
      name: 'FO_EOD (overall)',
      unit: 'FO_EOD_JOB_OVERALL',
      segments: [
        {
          type: 'overall',
          typeName: 'Overall Job',
          start: '2026-07-12 21:15:00',
          end: '2026-07-12 23:10:15',
          durationSec: 6915,
          durationFormatted: '1h 55m 15s',
        },
      ],
    },
    {
      id: 'fo_step1',
      name: 'PRE_TRADE_VAL',
      unit: 'FO_VALUATION',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 21:15:00',
          end: '2026-07-12 21:25:00',
          durationSec: 600,
          durationFormatted: '10m 00s',
        },
        {
          type: 'cpu',
          typeName: 'Time_CPU',
          start: '2026-07-12 21:25:00',
          end: '2026-07-12 21:45:00',
          durationSec: 1200,
          durationFormatted: '20m 00s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 21:45:00',
          end: '2026-07-12 22:10:00',
          durationSec: 1500,
          durationFormatted: '25m 00s',
        },
      ],
    },
    {
      id: 'fo_step2',
      name: 'POSITION_KEEPING',
      unit: 'FO_POSITION_BATCH',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-12 22:10:00',
          end: '2026-07-12 22:20:00',
          durationSec: 600,
          durationFormatted: '10m 00s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-12 22:20:00',
          end: '2026-07-12 23:10:15',
          durationSec: 3015,
          durationFormatted: '50m 15s',
        },
      ],
    },
  ],
};

export const mockBOOverviewTimelineData = {
  id: 'bo_eod',
  jobInfo: {
    title: 'BO_EOD Job Timeline',
    startTimeStr: '13-JUL-2026 01:05:20',
    endTimeStr: '13-JUL-2026 03:22:00',
    durationStr: '2h 16m 40s',
    baseDate: '2026-07-13',
    xRange: ['2026-07-13 01:00:00', '2026-07-13 03:25:00'],
  },
  categories: [
    { key: 'overall', name: 'Overall Job', color: '#3B82F6' },
    { key: 'cpu', name: 'Time_CPU', color: '#EC4899' },
    { key: 'syb', name: 'Time_Syb', color: '#00B4D8' },
    { key: 'idle', name: 'Idle / Wait', color: '#CBD5E1' },
  ],
  rows: [
    {
      id: 'bo_overall',
      name: 'BO_EOD (overall)',
      unit: 'BO_EOD_JOB_OVERALL',
      segments: [
        {
          type: 'overall',
          typeName: 'Overall Job',
          start: '2026-07-13 01:05:20',
          end: '2026-07-13 03:22:00',
          durationSec: 8200,
          durationFormatted: '2h 16m 40s',
        },
      ],
    },
    {
      id: 'bo_step1',
      name: 'SWIFT_GEN_FEED',
      unit: 'BO_SETTLEMENT',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-13 01:05:20',
          end: '2026-07-13 01:15:00',
          durationSec: 580,
          durationFormatted: '9m 40s',
        },
        {
          type: 'cpu',
          typeName: 'Time_CPU',
          start: '2026-07-13 01:15:00',
          end: '2026-07-13 01:45:00',
          durationSec: 1800,
          durationFormatted: '30m 00s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-13 01:45:00',
          end: '2026-07-13 02:15:00',
          durationSec: 1800,
          durationFormatted: '30m 00s',
        },
      ],
    },
    {
      id: 'bo_step2',
      name: 'CONFIRMATION_CHECK',
      unit: 'BO_CONFIRMATION',
      segments: [
        {
          type: 'idle',
          typeName: 'Idle / Wait',
          start: '2026-07-13 02:15:00',
          end: '2026-07-13 02:25:00',
          durationSec: 600,
          durationFormatted: '10m 00s',
        },
        {
          type: 'syb',
          typeName: 'Time_Syb',
          start: '2026-07-13 02:25:00',
          end: '2026-07-13 03:22:00',
          durationSec: 3420,
          durationFormatted: '57m 00s',
        },
      ],
    },
  ],
};

export const mockOverviewTimelineList = [
  { ...mockOverviewTimelineData, id: 'mo_eod' },
  mockFOOverviewTimelineData,
  mockBOOverviewTimelineData,
];

