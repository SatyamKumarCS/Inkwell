import {
  Blocks,
  CalendarDays,
  Hand,
  ListChecks,
  NotebookPen,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

export interface TourCard {
  key: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

export function tourCards(firstName: string): TourCard[] {
  return [
    {
      key: 'welcome',
      icon: Hand,
      title: `Hi ${firstName},`,
      body: "Here's a quick tour to give you a head start. Swipe to continue, or skip any time.",
    },
    {
      key: 'blocks',
      icon: Blocks,
      title: 'Write in blocks',
      body: 'Every paragraph, heading, list and image is a block you can move, restyle and link to.',
    },
    {
      key: 'daily',
      icon: NotebookPen,
      title: 'A note for every day',
      body: 'Capture thoughts, meetings and plans in a daily note that is always one tap away.',
    },
    {
      key: 'tasks',
      icon: ListChecks,
      title: 'Tasks wherever you write',
      body: 'Add a to-do in any doc and it shows up in your task lists, with due dates and reminders.',
    },
    {
      key: 'calendar',
      icon: CalendarDays,
      title: 'Plan your days',
      body: "See each day's tasks next to its note, and schedule work for the days ahead.",
    },
    {
      key: 'assistant',
      icon: Sparkles,
      title: 'An assistant that knows your notes',
      body: 'Ask questions about your docs, or summarise, rewrite and translate — with links to the sources.',
    },
    {
      key: 'spaces',
      icon: Users,
      title: 'Share when you are ready',
      body: 'Keep personal work private, invite others into shared spaces, and publish docs to the web.',
    },
  ];
}
