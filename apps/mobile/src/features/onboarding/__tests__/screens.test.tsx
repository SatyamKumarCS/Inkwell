import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import NotificationsScreen from '@/app/(onboarding)/notifications';
import TourScreen from '@/app/(onboarding)/tour';
import { useSession } from '@/features/auth/session';

import { hasNotificationPermission, requestNotificationPermission } from '../notifications';
import { markOnboardingStep } from '../progress';

jest.mock('../progress', () => ({ markOnboardingStep: jest.fn() }));
jest.mock('../notifications', () => ({
  hasNotificationPermission: jest.fn(() => Promise.resolve(false)),
  requestNotificationPermission: jest.fn(),
  notificationPromptSupported: jest.fn(() => true),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ uid: 'ada' });
});

describe('TourScreen', () => {
  it('greets the user and walks through the cards', async () => {
    useSession.setState({ profile: { firstName: 'Ada' } as never });
    await render(<TourScreen />);

    expect(screen.getByText('Hi Ada,')).toBeOnTheScreen();
    expect(screen.getByLabelText('Page 1 of 7')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Page 2 of 7')).toBeOnTheScreen();
  });

  it('can be skipped at any point', async () => {
    await render(<TourScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(markOnboardingStep).toHaveBeenCalledWith('ada', 'tourCompletedAt');
  });

  it('finishes from the last card', async () => {
    await render(<TourScreen />);
    for (let i = 0; i < 6; i++) await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Start writing' }));
    expect(markOnboardingStep).toHaveBeenCalledWith('ada', 'tourCompletedAt');
  });
});

describe('NotificationsScreen', () => {
  it('asks the system only after the user taps "Turn on"', async () => {
    jest.mocked(requestNotificationPermission).mockResolvedValue('granted');
    await render(<NotificationsScreen />);
    expect(requestNotificationPermission).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));
    expect(requestNotificationPermission).toHaveBeenCalled();
    expect(markOnboardingStep).toHaveBeenCalledWith('ada', 'notificationsPromptedAt');
  });

  it('"Not now" moves on without asking', async () => {
    await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(requestNotificationPermission).not.toHaveBeenCalled();
    expect(markOnboardingStep).toHaveBeenCalledWith('ada', 'notificationsPromptedAt');
  });

  it('offers Settings when Android blocks the prompt', async () => {
    jest.mocked(requestNotificationPermission).mockResolvedValue('blocked');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await render(<NotificationsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));

    expect(screen.getByText('Notifications are off')).toBeOnTheScreen();
    expect(markOnboardingStep).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(openSettings).toHaveBeenCalled();
  });

  it('skips itself when permission was already granted', async () => {
    jest.mocked(hasNotificationPermission).mockResolvedValue(true);
    await render(<NotificationsScreen />);
    await screen.findByText('Never miss a reminder');
    expect(markOnboardingStep).toHaveBeenCalledWith('ada', 'notificationsPromptedAt');
  });
});
