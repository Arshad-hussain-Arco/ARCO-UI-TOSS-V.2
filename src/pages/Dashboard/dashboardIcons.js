import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Download,
  Home,
  Upload,
  UserMinus,
  Users,
} from 'lucide-react';

/**
 * Maps the `iconKey` values returned by the dashboard service to concrete icon
 * components. Keeping the mapping here means the API stays free of presentation
 * details while the UI keeps full control of what is drawn.
 */
export const DASHBOARD_ICONS = {
  users: Users,
  building: Building2,
  clock: Clock,
  home: Home,
  userMinus: UserMinus,
  alertTriangle: AlertTriangle,
  alertCircle: AlertCircle,
  calendar: Calendar,
};

/** Icons for the activity feed, keyed by activity type. */
export const ACTIVITY_ICONS = {
  upload: Upload,
  update: Activity,
  import: Download,
};
