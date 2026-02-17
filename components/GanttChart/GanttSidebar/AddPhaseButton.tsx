import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';

interface AddPhaseButtonProps {
  onPress: () => void;
}

/**
 * Button to add a new phase
 */
export default function AddPhaseButton({ onPress }: AddPhaseButtonProps) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Plus size={18} color="#10B981" strokeWidth={2.5} />
      <Text style={styles.buttonText}>Add Phase</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    margin: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderStyle: 'dashed',
  },
  buttonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
});
