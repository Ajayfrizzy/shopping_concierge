import { Text, View } from 'react-native';
import type { SessionView } from '@youcam/shared';
import { adjustmentLabel, constraintLabel } from './presentation';
import { Button, Panel, styles } from './ui';

export function RelaxationChoices({
  session,
  disabled,
  onReview,
}: {
  session: SessionView;
  disabled: boolean;
  onReview: (proposalId: string) => void;
}) {
  return (
    <Panel>
      <Text style={styles.heading}>No exact matches found</Text>
      <Text style={styles.text}>Try one of these adjustments to continue your search.</Text>
      <Text style={styles.text}>
        These are search adjustments, not products. Nothing changes until you confirm. After
        confirmation, we search again and show product cards and images for exact matches.
      </Text>
      {session.pendingRelaxations.map((proposal) => {
        const unchanged = session.state.constraints.filter(
          (c) => !proposal.updates.some((p) => p.field === c.preference.field),
        );
        return (
          <View
            key={proposal.proposalId}
            style={{ gap: 8, borderTopWidth: 1, borderColor: '#9ba998', paddingTop: 14 }}
          >
            <Text style={styles.heading}>Proposed changes</Text>
            <Text style={styles.text}>{proposal.updates.map(constraintLabel).join('\n')}</Text>
            {!!unchanged.length && (
              <View style={{ gap: 4 }}>
                <Text style={styles.muted}>Kept as recorded</Text>
                <Text style={styles.muted}>
                  {unchanged.map((c) => constraintLabel(c.preference)).join('\n')}
                </Text>
              </View>
            )}
            <Button
              title={adjustmentLabel(proposal.updates)}
              secondary
              disabled={disabled}
              onPress={() => onReview(proposal.proposalId)}
            />
            <Text style={styles.muted}>
              Opens a review. Your search stays unchanged until confirmation.
            </Text>
          </View>
        );
      })}
    </Panel>
  );
}
