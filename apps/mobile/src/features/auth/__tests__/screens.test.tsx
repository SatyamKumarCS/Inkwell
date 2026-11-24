import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import SignInScreen from '@/app/(auth)/sign-in';
import VerifyScreen from '@/app/(auth)/verify';
import NameScreen from '@/app/(onboarding)/name';

import { completeProfile, requestEmailCode, signInWithEmailCode } from '../api';
import { useSession } from '../session';

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('../api', () => ({
  requestEmailCode: jest.fn(),
  signInWithEmailCode: jest.fn(),
  completeProfile: jest.fn(),
  signOut: jest.fn(),
}));

const httpsError = (details: object) => Object.assign(new Error('x'), { code: 'x', details });

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SignInScreen', () => {
  it('validates the email before calling the server', async () => {
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(requestEmailCode).not.toHaveBeenCalled();
  });

  it('sends a code and opens the code screen with the normalised email', async () => {
    jest.mocked(requestEmailCode).mockResolvedValue({ resendAfterSeconds: 60 });
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), ' Ada@Example.com ');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(requestEmailCode).toHaveBeenCalledWith('ada@example.com');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/verify',
      params: { email: 'ada@example.com', resendAfter: '60' },
    });
  });

  it('reuses a code sent moments ago instead of showing an error', async () => {
    jest
      .mocked(requestEmailCode)
      .mockRejectedValue(httpsError({ reason: 'rate-limited', retryAfterSeconds: 45 }));
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/verify',
      params: { email: 'ada@example.com', resendAfter: '45' },
    });
  });

  it('shows the daily-limit message', async () => {
    jest.mocked(requestEmailCode).mockRejectedValue(httpsError({ reason: 'daily-limit' }));
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByText("We can't send sign-in codes right now. Please try again later."),
    ).toBeOnTheScreen();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('VerifyScreen', () => {
  beforeEach(() => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ email: 'ada@example.com', resendAfter: '60' });
  });

  it('submits as soon as six digits are entered', async () => {
    jest.mocked(signInWithEmailCode).mockResolvedValue();
    await render(<VerifyScreen />);
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '720 602');

    expect(signInWithEmailCode).toHaveBeenCalledWith('ada@example.com', '720602');
  });

  it.each([
    [{ reason: 'invalid-code', attemptsLeft: 4 }, "That code isn't right. 4 attempts left."],
    [{ reason: 'code-expired' }, 'This code has expired. Send a new one.'],
    [{ reason: 'too-many-attempts' }, 'Too many wrong codes. Send a new one.'],
  ])('explains %j and clears the input', async (details, message) => {
    jest.mocked(signInWithEmailCode).mockRejectedValue(httpsError(details));
    await render(<VerifyScreen />);
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '000000');

    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.getByLabelText('Verification code').props.value).toBe('');
  });

  it('counts down before allowing a resend', async () => {
    jest.useFakeTimers();
    jest.mocked(requestEmailCode).mockResolvedValue({ resendAfterSeconds: 60 });
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ email: 'ada@example.com', resendAfter: '2' });
    await render(<VerifyScreen />);

    expect(screen.getByRole('button', { name: 'Resend code in 0:02' })).toBeDisabled();
    // Each tick is scheduled after the previous render, so advance one second at a time.
    await act(() => jest.advanceTimersByTime(1000));
    await act(() => jest.advanceTimersByTime(1000));
    await fireEvent.press(screen.getByRole('button', { name: 'Resend code' }));

    expect(requestEmailCode).toHaveBeenCalledWith('ada@example.com');
    expect(await screen.findByText('We sent you a new code.')).toBeOnTheScreen();
  });
});

describe('NameScreen', () => {
  it('requires a first name, then creates the profile', async () => {
    jest.mocked(completeProfile).mockResolvedValue({ spaceId: 's1' });
    await render(<NameScreen />);
    const submit = screen.getByRole('button', { name: 'Continue' });
    expect(submit).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('First name'), 'Ada');
    await fireEvent.changeText(screen.getByLabelText('Last name (optional)'), 'Lovelace');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(completeProfile).toHaveBeenCalledWith({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('prefills a name shared by the sign-in provider', async () => {
    useSession.setState({ nameHint: { firstName: 'Grace', lastName: 'Hopper' } });
    await render(<NameScreen />);
    expect(screen.getByLabelText('First name').props.value).toBe('Grace');
    useSession.setState({ nameHint: null });
  });

  it('shows the offline message when the call fails for lack of network', async () => {
    jest.mocked(completeProfile).mockRejectedValue({ code: 'unavailable' });
    await render(<NameScreen />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Ada');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText("You're offline. Connect to the internet and try again."),
    ).toBeOnTheScreen();
  });
});
