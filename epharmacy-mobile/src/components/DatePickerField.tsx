import React, { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { TextInput, Portal, Dialog, Button } from 'react-native-paper';
// @ts-ignore
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

function parseYYYYMMDD(s?: string): Date | null {
  if (!s) return null;
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return null;
  return d;
}

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  label: string;
  value?: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  style?: any;
  disabled?: boolean;
}

const DatePickerField: React.FC<Props> = ({ label, value, onChange, style, disabled }) => {
  const [show, setShow] = useState(false);
  const committed = useMemo(() => parseYYYYMMDD(value) || new Date(), [value]);
  const [tempDate, setTempDate] = useState<Date>(committed);

  const open = () => {
    if (disabled) return;
    if (Platform.OS === 'web') return;
    setTempDate(committed);
    setShow(true);
  };

  const onNativeChange = (e: DateTimePickerEvent, d?: Date) => {
    if (!d) {
      if (Platform.OS === 'android') setShow(false);
      return;
    }
    setTempDate(d);
    // On Android default picker, commit immediately when user sets a date
    if (Platform.OS === 'android' && e.type === 'set') {
      onChange(toYYYYMMDD(d));
      setShow(false);
    }
  };

  const onCancel = () => {
    setShow(false);
    setTempDate(committed);
  };

  const onConfirm = () => {
    onChange(toYYYYMMDD(tempDate));
    setShow(false);
  };

  return (
    <View>
      <TextInput
        label={label}
        value={value || ''}
        onChangeText={(t) => onChange(t)}
        mode="outlined"
        style={[style, { overflow: 'hidden' }]}
        dense
        maxLength={10}
        editable={Platform.OS === 'web'}
        right={<TextInput.Icon icon="calendar" onPress={open} />}
        placeholder="YYYY-MM-DD"
      />
      {Platform.OS !== 'web' && (
      <Portal>
        <Dialog visible={show} onDismiss={onCancel} style={{ borderRadius: 12 }}>
          <Dialog.Title>{label}</Dialog.Title>
          <Dialog.Content>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onNativeChange}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={onCancel}>Cancel</Button>
            <Button onPress={onConfirm}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      )}
    </View>
  );
};

export default DatePickerField; 