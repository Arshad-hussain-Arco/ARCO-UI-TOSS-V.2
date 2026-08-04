// Single import surface for the shared component library.
// New/gap-fill primitives live physically in common/; existing primitives are
// re-exported from their current locations to avoid risky mass file moves —
// page migrations should import from here going forward.

export { Button } from '@components/ui/Button/Button';
export { Toggle } from '@components/ui/Toggle/Toggle';
export { AdminModal as Modal } from '@components/ui/AdminModal/AdminModal';
export { AdminTable as Table } from '@components/ui/AdminTable/AdminTable';
export { DotsLoader } from '@components/ui/DotsLoader/DotsLoader';
export { StatCard } from '@components/ui/StatCard';
export { Pill as Badge } from '@components/ui/Pill';
export { ProgressBar } from '@components/ui/ProgressBar';
export { AlertRow } from '@components/ui/AlertRow';
export { Avatar } from '@components/ui/Avatar';

export { Spinner, Spinner as Loader } from '@components/feedback/Spinner/Spinner';
export { Skeleton } from '@components/feedback/Skeleton/Skeleton';
export { TableSkeleton } from '@components/feedback/Skeleton/TableSkeleton';
export { ListSkeleton } from '@components/feedback/Skeleton/ListSkeleton';
export { CardGridSkeleton } from '@components/feedback/Skeleton/CardGridSkeleton';
export { StatsRowSkeleton } from '@components/feedback/Skeleton/StatsRowSkeleton';
export { DetailSkeleton } from '@components/feedback/Skeleton/DetailSkeleton';
export { EmptyState } from '@components/feedback/EmptyState/EmptyState';
export { ErrorState } from '@components/feedback/ErrorState/ErrorState';
export { Toaster } from '@components/feedback/Toast/Toaster';

export { Select as Dropdown } from '@components/forms/Select/Select';
export { DatePicker } from '@components/forms/DatePicker/DatePicker';
export { TimePicker } from './TimePicker/TimePicker';
export { FileUpload as Upload } from '@components/forms/FileUpload/FileUpload';
export { SearchInput } from '@components/forms/SearchInput/SearchInput';

export { Breadcrumb } from '@components/navigation/Breadcrumb/Breadcrumb';
export { PageHeader } from '@components/navigation/PageHeader/PageHeader';

export { Input } from './Input/Input';
export { PasswordInput } from './PasswordInput/PasswordInput';
export { NumberInput } from './NumberInput/NumberInput';
export { Textarea } from './Textarea/Textarea';
export { Checkbox } from './Checkbox/Checkbox';
export { Radio } from './Radio/Radio';
export { Card } from './Card/Card';
export { Tooltip } from './Tooltip/Tooltip';
export { IconButton } from './IconButton/IconButton';
export { ExportButton } from './ExportButton/ExportButton';
export { Tabs } from './Tabs/Tabs';
export { ConfirmationModal } from './ConfirmationModal/ConfirmationModal';
export { FormModal } from './FormModal/FormModal';
