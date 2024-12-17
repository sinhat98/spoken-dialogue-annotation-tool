import React, { useState, useEffect } from 'react';
import { SlotValue } from '../types';
import SlotIntentEditor from './SlotIntentEditor.tsx';

interface SlotIntentContainerProps {
    predefinedSlotKeys?: string[];
    predefinedIntents?: string[];
    isDialogueLevel?: boolean;
    initialSlots?: SlotValue[];
    initialIntent?: string;
    onSlotsUpdate?: (slots: SlotValue[]) => void;
    onIntentUpdate?: (intent: string) => void;
}

const SlotIntentContainer: React.FC<SlotIntentContainerProps> = ({
    predefinedSlotKeys = [],
    predefinedIntents = [],
    isDialogueLevel = false,
    initialSlots = [],
    initialIntent = '',
    onSlotsUpdate,
    onIntentUpdate,
}) => {
    const [slots, setSlots] = useState<SlotValue[]>(initialSlots);
    const [dialogueSlots, setDialogueSlots] = useState<SlotValue[]>([]);
    const [intent, setIntent] = useState<string>(initialIntent);
    const [isEditingIntent, setIsEditingIntent] = useState(false);

    // スロットの削除ハンドラー
    const handleRemoveSlot = (index: number) => {
        setSlots(prevSlots => {
            const newSlots = prevSlots.filter((_, i) => i !== index);
            // 親コンポーネントに変更を通知
            onSlotsUpdate?.(newSlots);
            return newSlots;
        });
    };

    // initialSlots が変更されたときに slots を更新
    useEffect(() => {
        setSlots(initialSlots);
    }, [initialSlots]);

    const handleSlotsChange = (newSlots: SlotValue[]) => {
        console.log('handleSlotsChange called with:', newSlots);
        setSlots(newSlots);
        onSlotsUpdate?.(newSlots);
    };

    const handleDialogueSlotsChange = (newDialogueSlots: SlotValue[]) => {
        console.log('handleDialogueSlotsChange called with:', newDialogueSlots);
        setDialogueSlots(newDialogueSlots);
    };

    const handleIntentChange = (newIntent: string) => {
        setIntent(newIntent);
        onIntentUpdate?.(newIntent);
    };

    // インテントの確定処理
    const handleIntentConfirm = () => {
        setIsEditingIntent(false);
    };

    // initialIntent が変更されたときに intent を更新
    useEffect(() => {
        setIntent(initialIntent);
    }, [initialIntent]);

    // 状態変更を監視
    useEffect(() => {
        console.log('Slots state changed:', slots);
    }, [slots]);

    useEffect(() => {
        console.log('DialogueSlots state changed:', dialogueSlots);
    }, [dialogueSlots]);

    return (
        <SlotIntentEditor
            intent={intent}
            slots={slots}
            dialogueSlots={dialogueSlots}
            predefinedIntents={predefinedIntents}
            predefinedSlotKeys={predefinedSlotKeys}
            onIntentChange={handleIntentChange}
            onSlotsChange={handleSlotsChange}
            onDialogueSlotsChange={handleDialogueSlotsChange}
            isDialogueLevel={isDialogueLevel}
            onDeleteSlot={handleRemoveSlot}
            showIntent={!isDialogueLevel}
        />
    );
};

export default SlotIntentContainer; 