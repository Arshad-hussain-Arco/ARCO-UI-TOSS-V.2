import React from 'react';
import { StatCard, Pill, ProgressBar, AlertRow, Avatar } from '../index';

describe('UI Design System Components', () => {
  test('StatCard renders without crashing and forwards className', () => {
    const FakeIcon = (props) => <svg {...props} data-testid="icon" />;
    const card = (
      <StatCard
        icon={FakeIcon}
        label="Pending Approvals"
        value={12}
        variant="amber"
        trend={{ direction: 'up', value: '+3 today' }}
        caption="Requires attention"
        className="custom-stat-card"
      />
    );
    expect(card).toBeTruthy();
    expect(card.props.className).toBe('custom-stat-card');
    expect(card.props.variant).toBe('amber');
  });

  test('Pill renders without crashing and forwards className', () => {
    const pill = (
      <Pill variant="green" className="status-badge">
        Approved
      </Pill>
    );
    expect(pill).toBeTruthy();
    expect(pill.props.className).toBe('status-badge');
    expect(pill.props.children).toBe('Approved');
  });

  test('ProgressBar renders without crashing and forwards className', () => {
    const progress = (
      <ProgressBar
        label="Annual Leave"
        percent={75}
        count="15 / 20 days used"
        variant="blue"
        className="custom-progress"
      />
    );
    expect(progress).toBeTruthy();
    expect(progress.props.className).toBe('custom-progress');
    expect(progress.props.percent).toBe(75);
  });

  test('AlertRow renders without crashing and forwards className', () => {
    const alert = (
      <AlertRow
        message="System outage scheduled for midnight."
        variant="red"
        className="urgent-alert"
      />
    );
    expect(alert).toBeTruthy();
    expect(alert.props.className).toBe('urgent-alert');
    expect(alert.props.variant).toBe('red');
  });

  test('Avatar renders without crashing and derives initials', () => {
    const avatar = (
      <Avatar name="Jane Doe" size={32} className="user-avatar" />
    );
    expect(avatar).toBeTruthy();
    expect(avatar.props.name).toBe('Jane Doe');
    expect(avatar.props.className).toBe('user-avatar');
  });
});
