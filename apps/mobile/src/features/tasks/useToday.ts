import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { isoDate } from './dates';

/** Today's local "YYYY-MM-DD"; rolls over at midnight and when the app comes back to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(() => isoDate(new Date()));
  useEffect(() => {
    const tick = () => setToday(isoDate(new Date()));
    const timer = setInterval(tick, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return today;
}
