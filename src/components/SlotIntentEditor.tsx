import React, { useState, useMemo, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    Autocomplete,
    Chip,
    Stack,
    IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { SlotValue } from '../types';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { motion, AnimatePresence } from 'framer-motion';
import { green, grey } from '@mui/material/colors';
import { useSnackbar } from 'notistack';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';

interface SlotIntentEditorProps {
    turnIndex?: number;
    intent?: string;
    slots?: SlotValue[];
    dialogueSlots?: SlotValue[];
    predefinedIntents?: string[];
    predefinedSlotKeys?: string[];
    onIntentChange?: (intent: string) => void;
    onSlotsChange?: (slots: SlotValue[]) => void;
    onDialogueSlotsChange?: (slots: SlotValue[]) => void;
    isDialogueLevel?: boolean;
    onDeleteTurn?: () => void;
    onDeleteSlot?: (index: number) => void;
    showIntent?: boolean;
    onCustomSlotAdd?: (slotKey: string) => void;
}

interface EditingSlot {
    key: string;
    value: string;
    isConfirmed: boolean;
}

const SlotIntentEditor: React.FC<SlotIntentEditorProps> = ({
    turnIndex,
    intent = '',
    slots = [],
    dialogueSlots = [],
    predefinedIntents = [],
    predefinedSlotKeys = [],
    onIntentChange,
    onSlotsChange,
    onDialogueSlotsChange,
    isDialogueLevel = false,
    onDeleteTurn,
    onDeleteSlot,
    showIntent = true,
    onCustomSlotAdd,
}) => {
    const { enqueueSnackbar } = useSnackbar();

    // 編集中のスロットの状態管理
    const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([]);
    const [isSelectingSlot, setIsSelectingSlot] = useState(false);
    const [selectedSlotKey, setSelectedSlotKey] = useState<string>('');

    // 利用可能なスロットキーを計算
    const availableSlotKeys = useMemo(() => {
        // 既存のスロットのキーを取得
        const existingSlotKeys = slots.map(slot => slot.key);
        // 編集中のスロットのキーを取得
        const editingSlotKeys = editingSlots.map(slot => slot.key);
        // 両方のキーを除外した利用可能なキーを返す
        return predefinedSlotKeys.filter(key =>
            !existingSlotKeys.includes(key) && !editingSlotKeys.includes(key)
        );
    }, [predefinedSlotKeys, slots, editingSlots]);

    // スロットの追加（編集モードへ）
    const handleAddEditingSlot = (key: string) => {
        // 既存のスロットや編集中のスロットと重複しないことを確認
        const isExistingSlot = slots.some(slot => slot.key === key);
        const isEditingSlot = editingSlots.some(slot => slot.key === key);

        if (!isExistingSlot && !isEditingSlot) {
            setEditingSlots(prevSlots => [...prevSlots, {
                key,
                value: '',
                isConfirmed: false
            }]);
            setIsSelectingSlot(false);
            setSelectedSlotKey('');

            // 新しいフィールドにフォーカスを当てる
            setTimeout(() => {
                const inputElement = document.querySelector(`input[data-slot-key="${key}"]`) as HTMLInputElement;
                if (inputElement) {
                    inputElement.focus();
                }
            }, 100);
        }
    };

    // スロットの値を更新（未確定のスロットのみ）
    const handleUpdateSlotValue = (key: string, value: string) => {
        setEditingSlots(editingSlots.map(slot =>
            slot.key === key && !slot.isConfirmed ? { ...slot, value } : slot
        ));
    };

    // 編集中のスロットを確定
    const handleConfirmSlot = (editingSlot: EditingSlot) => {
        if (!editingSlot.value.trim()) return;

        // スロットを保存
        const newSlot: SlotValue = {
            key: editingSlot.key,
            value: editingSlot.value.trim()
        };

        // ターンレベルのスロットを更新
        if (onSlotsChange) {
            const newSlots = [...slots];
            const existingIndex = newSlots.findIndex(s => s.key === newSlot.key);
            if (existingIndex >= 0) {
                newSlots[existingIndex] = newSlot;
            } else {
                newSlots.push(newSlot);
            }
            onSlotsChange(newSlots);

            // 確定フィードバックを表示
            enqueueSnackbar(`${editingSlot.key}: ${editingSlot.value} を保存しました`, {
                variant: 'success',
                autoHideDuration: 2000,
                anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
            });

            // 編集中のスロットを保存済みスロットとして追加した後に削除
            setEditingSlots(prevSlots => prevSlots.filter(slot => slot.key !== editingSlot.key));
        }
    };

    // Autocompleteでスロットが選択された時の処理
    const handleSlotSelection = (value: string | null) => {
        if (value) {
            handleAddEditingSlot(value);
            // フォーカスを新しい入力フィールドに移動させる
            setTimeout(() => {
                const inputElement = document.querySelector(`input[data-slot-key="${value}"]`) as HTMLInputElement;
                if (inputElement) {
                    inputElement.focus();
                }
            }, 100);
        }
    };

    // スロットを削除
    const handleRemoveSlot = (index: number) => {
        const removedSlot = slots[index];

        // 親コンポーネントに削除を通知
        if (onDeleteSlot) {
            onDeleteSlot(index);
        } else if (onSlotsChange) {
            const newSlots = [...slots];
            newSlots.splice(index, 1);
            onSlotsChange(newSlots);
        }

        // 削除フィードバックを表示
        enqueueSnackbar(`${removedSlot.key}: ${removedSlot.value} を削除しました`, {
            variant: 'info',
            autoHideDuration: 2000,
            anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
        });

        // スロット選択UIを表示
        setIsSelectingSlot(true);
    };

    // 編集中のスロットを削除
    const handleRemoveEditingSlot = (key: string) => {
        setEditingSlots(prevSlots => prevSlots.filter(slot => slot.key !== key));
        setIsSelectingSlot(true);
    };

    // すべての確定済みスロットを保存
    const handleSaveAllConfirmedSlots = () => {
        const confirmedSlots = editingSlots
            .filter(slot => slot.isConfirmed)
            .map(({ key, value }) => ({ key, value }));

        if (onSlotsChange) {
            // 既存のスロットと新しいスロットをマージ
            const newSlots = [...slots];
            confirmedSlots.forEach(newSlot => {
                const existingIndex = newSlots.findIndex(s => s.key === newSlot.key);
                if (existingIndex >= 0) {
                    newSlots[existingIndex] = newSlot;
                } else {
                    newSlots.push(newSlot);
                }
            });
            onSlotsChange(newSlots);

            // 対話レベルのスロットを更新
            if (onDialogueSlotsChange) {
                const newDialogueSlots = [...(dialogueSlots || [])];
                confirmedSlots.forEach(newSlot => {
                    const dialogueSlotIndex = newDialogueSlots.findIndex(s => s.key === newSlot.key);
                    if (dialogueSlotIndex >= 0) {
                        newDialogueSlots[dialogueSlotIndex] = newSlot;
                    } else {
                        newDialogueSlots.push(newSlot);
                    }
                });
                onDialogueSlotsChange(newDialogueSlots);
            }

            // 確定済みのスロットを編集中リストから削除
            setEditingSlots(prevSlots => prevSlots.filter(slot => !slot.isConfirmed));

            // 保存完了フィードバックを表示
            enqueueSnackbar('すべての確定済みスロットを保存しました', {
                variant: 'success',
                autoHideDuration: 2000,
                anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
            });
        }
    };

    // ローカルの状態を追加
    const [localIntent, setLocalIntent] = useState(intent);

    // intentが変更されたときにlocalIntentを更新
    useEffect(() => {
        setLocalIntent(intent);
    }, [intent]);

    return (
        <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                {/* インテント入力フィールド */}
                {showIntent && (
                    <Box sx={{ minWidth: '300px' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                            インテント:
                        </Typography>
                        <Autocomplete
                            freeSolo
                            size="small"
                            value={localIntent}
                            options={predefinedIntents}
                            onChange={(_, newValue) => {
                                setLocalIntent(newValue || '');
                                onIntentChange?.(newValue || '');
                            }}
                            onInputChange={(_, newValue) => {
                                setLocalIntent(newValue);
                            }}
                            onBlur={() => {
                                onIntentChange?.(localIntent);
                            }}
                            sx={{ width: '100%' }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="インテントを入力"
                                    size="small"
                                />
                            )}
                        />
                    </Box>
                )}

                {/* スロット入力 */}
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                        スロット:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* 既存のスロット関連のUI */}
                        <AnimatePresence mode="popLayout">
                            {slots.map((slot, index) => (
                                <motion.div
                                    key={`${slot.key}-${index}`}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    whileHover={{ scale: 1.05 }}
                                    layout
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            bgcolor: 'background.paper',
                                            py: 0.5,
                                            px: 1,
                                            borderRadius: 1,
                                            border: `1px solid ${grey[300]}`,
                                            '&:hover': {
                                                bgcolor: grey[50],
                                                borderColor: grey[400]
                                            }
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'text.primary',
                                                fontWeight: 500,
                                                fontSize: '1.1rem'
                                            }}
                                        >
                                            {slot.key}:
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'text.secondary',
                                                fontSize: '1.1rem'
                                            }}
                                        >
                                            {slot.value}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleRemoveSlot(index)}
                                            sx={{
                                                p: 0.2,
                                                ml: 0.5,
                                                color: grey[500],
                                                '&:hover': {
                                                    color: 'error.main',
                                                    bgcolor: 'error.light'
                                                }
                                            }}
                                        >
                                            <DeleteIcon sx={{ fontSize: '1.1rem' }} />
                                        </IconButton>
                                    </Box>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* 編集中のスロット */}
                        <AnimatePresence mode="popLayout">
                            {editingSlots.map((slot) => (
                                <motion.div
                                    key={slot.key}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    layout
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            bgcolor: slot.isConfirmed ? grey[50] : 'background.paper',
                                            p: 1,
                                            borderRadius: 1,
                                            boxShadow: 1,
                                            border: `1px solid ${slot.isConfirmed ? grey[300] : green[300]}`,
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: slot.isConfirmed ? grey[600] : 'text.primary',
                                                fontWeight: 500,
                                                fontSize: '1.1rem'
                                            }}
                                        >
                                            {slot.key}:
                                        </Typography>
                                        <TextField
                                            size="medium"
                                            value={slot.value}
                                            onChange={(e) => handleUpdateSlotValue(slot.key, e.target.value)}
                                            disabled={slot.isConfirmed}
                                            inputProps={{
                                                'data-slot-key': slot.key,
                                                style: {
                                                    color: slot.isConfirmed ? grey[600] : 'inherit',
                                                    padding: '2px 4px',
                                                    fontSize: '1.1rem'
                                                }
                                            }}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && slot.value.trim() && !slot.isConfirmed) {
                                                    e.preventDefault();
                                                    handleConfirmSlot(slot);
                                                }
                                            }}
                                            sx={{
                                                width: '120px',
                                                '& .MuiInputBase-root': {
                                                    height: '32px',
                                                    bgcolor: slot.isConfirmed ? grey[50] : 'background.paper',
                                                    fontSize: '1.1rem'
                                                }
                                            }}
                                        />
                                        {!slot.isConfirmed ? (
                                            <IconButton
                                                size="medium"
                                                onClick={() => handleConfirmSlot(slot)}
                                                disabled={!slot.value.trim()}
                                                sx={{
                                                    '&:not(:disabled)': {
                                                        color: green[500],
                                                        '&:hover': {
                                                            bgcolor: green[50]
                                                        }
                                                    }
                                                }}
                                            >
                                                <CheckIcon sx={{ fontSize: '1.1rem' }} />
                                            </IconButton>
                                        ) : (
                                            <IconButton
                                                size="medium"
                                                onClick={() => handleRemoveEditingSlot(slot.key)}
                                                sx={{
                                                    color: grey[500],
                                                    '&:hover': {
                                                        color: 'error.main',
                                                        bgcolor: 'error.light'
                                                    }
                                                }}
                                            >
                                                <DeleteIcon sx={{ fontSize: '1.1rem' }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* スロット選択メニュー */}
                        {isSelectingSlot ? (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                <>
                                    <Autocomplete
                                        size="medium"
                                        options={availableSlotKeys}
                                        value={selectedSlotKey}
                                        onChange={(_, value) => handleSlotSelection(value)}
                                        freeSolo
                                        onInputChange={(_, newValue) => {
                                            if (newValue && !availableSlotKeys.includes(newValue)) {
                                                onCustomSlotAdd?.(newValue);
                                            }
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                placeholder="スロットを選択または入力"
                                                size="medium"
                                                autoFocus
                                                sx={{
                                                    width: '200px',
                                                    '& .MuiInputBase-root': {
                                                        height: '32px',
                                                        fontSize: '1.1rem'
                                                    },
                                                    '& .MuiInputBase-input': {
                                                        fontSize: '1.1rem'
                                                    }
                                                }}
                                            />
                                        )}
                                    />
                                </>
                            </Box>
                        ) : (
                            <IconButton
                                size="medium"
                                onClick={() => setIsSelectingSlot(true)}
                                disabled={availableSlotKeys.length === 0}
                                sx={{
                                    border: `1px dashed ${grey[300]}`,
                                    borderRadius: 1,
                                    p: 1,
                                    '&:hover': {
                                        bgcolor: grey[50]
                                    }
                                }}
                            >
                                <AddIcon sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                        )}

                        {/* 確定済みスロットの一括保存ボタン */}
                        {editingSlots.some(slot => slot.isConfirmed) && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                            >
                                <IconButton
                                    size="medium"
                                    onClick={handleSaveAllConfirmedSlots}
                                    sx={{
                                        color: green[500],
                                        bgcolor: green[50],
                                        border: `1px solid ${green[200]}`,
                                        borderRadius: 1,
                                        p: 1,
                                        '&:hover': {
                                            bgcolor: green[100]
                                        }
                                    }}
                                >
                                    <SaveIcon sx={{ fontSize: '1.1rem' }} />
                                </IconButton>
                            </motion.div>
                        )}
                    </Box>
                </Box>
            </Box>
        </Stack>
    );
};

export default SlotIntentEditor;