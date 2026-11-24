import { Database } from 'lucide-react-native';

import { Button, ListRow } from '@/components';
import { resetFirestoreUsage, useFirestoreUsage } from '@/lib/firestoreUsage';

/** Dev builds only: this session's estimated Firestore reads/writes (Spark quota, SPEC.md §1.1). */
export function FirestoreUsageRow() {
  const reads = useFirestoreUsage((s) => s.reads);
  const writes = useFirestoreUsage((s) => s.writes);

  return (
    <ListRow
      title="Firestore this session"
      subtitle={`${reads} reads · ${writes} writes (Spark: 50k reads, 20k writes per day, all users)`}
      icon={Database}
      trailing={<Button label="Reset" variant="ghost" onPress={resetFirestoreUsage} />}
    />
  );
}
