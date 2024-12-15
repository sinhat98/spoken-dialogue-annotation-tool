import React, { useState, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Autocomplete,
    Button,
    Stack,
    Chip,
    IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { SlotValue } from '../types';

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
}

interface EditingSlot {
    key: string;
    value: string;
    isEditing: boolean;
}

const SlotIntentEditor: React.FC<SlotIntentEditorProps> = ({
    turnIndex,
    intent,
    slots = [],
    dialogueSlots = [],
    predefinedIntents,
    predefinedSlotKeys = [],
    onIntentChange,
    onSlotsChange,
    onDialogueSlotsChange,
    isDialogueLevel = false
}) => {
    // 編集中のスロットの状態管理
    const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([]);
    const currentSlots = isDialogueLevel ? dialogueSlots : slots;
    const [newSlotKey, setNewSlotKey] = useState('');

    // 確定済みスロットのキーを取得
    const confirmedSlotKeys = useMemo(() =>
        currentSlots.map(slot => slot.key),
        [currentSlots]
    );

    // 利用可能なスロットキーを取得
    const availableSlotKeys = useMemo(() =>
        predefinedSlotKeys.filter(key => !confirmedSlotKeys.includes(key)),
        [predefinedSlotKeys, confirmedSlotKeys]
    );

    // 編集中のスロットを追加
    const handleAddEditingSlot = (key: string) => {
        if (!editingSlots.find(slot => slot.key === key)) {
            setEditingSlots([...editingSlots, { key, value: '', isEditing: true }]);
        }
    };

    // スロットの値を更新
    const handleUpdateSlotValue = (key: string, value: string) => {
        setEditingSlots(editingSlots.map(slot =>
            slot.key === key ? { ...slot, value } : slot
        ));
    };

    // スロットを確定
    const handleConfirmSlot = (editingSlot: EditingSlot) => {
        if (editingSlot.value.trim()) {
            const newSlot: SlotValue = { key: editingSlot.key, value: editingSlot.value.trim() };
            if (isDialogueLevel && onDialogueSlotsChange) {
                onDialogueSlotsChange([...dialogueSlots, newSlot]);
            } else if (onSlotsChange) {
                onSlotsChange([...slots, newSlot]);
            }
            setEditingSlots(editingSlots.filter(slot => slot.key !== editingSlot.key));
        }
    };

    // スロットを削除
    const handleRemoveSlot = (index: number) => {
        if (isDialogueLevel && onDialogueSlotsChange) {
            onDialogueSlotsChange(dialogueSlots.filter((_, i) => i !== index));
        } else if (onSlotsChange) {
            onSlotsChange(slots.filter((_, i) => i !== index));
        }
    };

    // 編集中のスロットを削除
    const handleRemoveEditingSlot = (key: string) => {
        setEditingSlots(editingSlots.filter(slot => slot.key !== key));
    };

    // 新しいスロットキーを追加
    const handleAddNewSlot = () => {
        if (newSlotKey && !predefinedSlotKeys.includes(newSlotKey)) {
            setEditingSlots([...editingSlots, { key: newSlotKey, value: '', isEditing: true }]);
            setNewSlotKey('');
        }
    };

    const handleDragEnd = (result: any) => {
        if (!result.destination) return;

        const items = Array.from(currentSlots);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        if (isDialogueLevel && onDialogueSlotsChange) {
            onDialogueSlotsChange(items);
        } else if (onSlotsChange) {
            onSlotsChange(items);
        }
    };

    const MotionPaper = motion(Paper);

    return (
        <MotionPaper
            elevation={1}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            sx={{ p: isDialogueLevel ? 0.75 : 1.5 }}
        >
            <Stack spacing={isDialogueLevel ? 0.75 : 1.5}>
                {/* Intent Field - Only show for turn-level annotation */}
                {!isDialogueLevel && (
                    <Box>
                        <Typography
                            variant="subtitle1"
                            gutterBottom
                            sx={{
                                fontSize: '1.3rem',
                                fontWeight: 500,
                                mb: 1
                            }}
                        >
                            ターン {turnIndex! + 1} のインテント
                        </Typography>
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                            <Autocomplete
                                freeSolo
                                value={intent}
                                options={predefinedIntents || []}
                                onChange={(_, newValue) => onIntentChange?.(newValue || '')}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="インテント"
                                        variant="outlined"
                                        fullWidth
                                        sx={{
                                            '& .MuiInputBase-input': {
                                                fontSize: '1rem',
                                                py: 1
                                            }
                                        }}
                                    />
                                )}
                            />
                        </motion.div>
                    </Box>
                )}

                {/* Slots Section */}
                <Box>
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontSize: '1.3rem',
                            fontWeight: 500,
                            mb: 0
                        }}
                    >
                        {isDialogueLevel ? '対話全体スロット' : 'ターンスロット'}
                    </Typography>

                    {/* Confirmed Slots with Drag and Drop */}
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="slots" direction="horizontal">
                            {(provided) => (
                                <Box
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 1.5,
                                        minHeight: isDialogueLevel ? 40 : 40,
                                        my: 2
                                    }}
                                >
                                    <AnimatePresence>
                                        {currentSlots.map((slot, index) => (
                                            <Draggable
                                                key={`${slot.key}-${index}`}
                                                draggableId={`${slot.key}-${index}`}
                                                index={index}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                    >
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.8 }}
                                                            whileHover={{ scale: 1.05 }}
                                                            style={{
                                                                transformOrigin: 'center',
                                                                zIndex: snapshot.isDragging ? 999 : 'auto'
                                                            }}
                                                        >
                                                            <Chip
                                                                label={`${slot.key}: ${slot.value}`}
                                                                color={isDialogueLevel ? "secondary" : "primary"}
                                                                onDelete={() => handleRemoveSlot(index)}
                                                                deleteIcon={<DeleteIcon fontSize="medium" />}
                                                                size="medium"
                                                                sx={{
                                                                    fontSize: '1.1rem',
                                                                    height: isDialogueLevel ? '32px' : '40px',
                                                                    '& .MuiChip-label': {
                                                                        px: 2
                                                                    },
                                                                    boxShadow: snapshot.isDragging ? '0 5px 10px rgba(0,0,0,0.1)' : 'none'
                                                                }}
                                                            />
                                                        </motion.div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                    </AnimatePresence>
                                    {provided.placeholder}
                                </Box>
                            )}
                        </Droppable>
                    </DragDropContext>

                    {/* Available Slots */}
                    <Box sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        mb: 1.5,
                        minHeight: isDialogueLevel ? 40 : 40
                    }}>
                        <AnimatePresence>
                            {availableSlotKeys.map((key) => (
                                <motion.div
                                    key={key}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    whileHover={{ scale: 1.05 }}
                                >
                                    <Chip
                                        label={key}
                                        variant="outlined"
                                        onClick={() => handleAddEditingSlot(key)}
                                        color={isDialogueLevel ? "secondary" : "primary"}
                                        sx={{
                                            cursor: 'pointer',
                                            fontSize: '1.1rem',
                                            height: isDialogueLevel ? '32px' : '40px',
                                            '& .MuiChip-label': {
                                                px: 2
                                            }
                                        }}
                                        size="medium"
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </Box>

                    {/* Editing Slots */}
                    <Box sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        mb: 1.5,
                        minHeight: isDialogueLevel ? 40 : 40
                    }}>
                        <AnimatePresence>
                            {editingSlots.map((slot) => (
                                <motion.div
                                    key={slot.key}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    whileHover={{ scale: 1.02 }}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            bgcolor: 'background.paper',
                                            border: 1,
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            px: 1.5,
                                            py: 0.5,
                                            height: isDialogueLevel ? '32px' : '40px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                        }}
                                    >
                                        <Typography
                                            variant="body1"
                                            color="text.secondary"
                                            sx={{
                                                fontSize: '1.1rem',
                                                fontWeight: 500
                                            }}
                                        >
                                            {slot.key}:
                                        </Typography>
                                        <TextField
                                            size="medium"
                                            value={slot.value}
                                            onChange={(e) => handleUpdateSlotValue(slot.key, e.target.value)}
                                            sx={{
                                                width: '180px',
                                                '& .MuiOutlinedInput-root': {
                                                    height: isDialogueLevel ? '32px' : '40px',
                                                    fontSize: '1.1rem'
                                                },
                                                '& .MuiOutlinedInput-input': {
                                                    py: 0.5,
                                                    px: 1.5
                                                }
                                            }}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && slot.value.trim()) {
                                                    handleConfirmSlot(slot);
                                                }
                                            }}
                                        />
                                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                            <IconButton
                                                size="medium"
                                                onClick={() => handleConfirmSlot(slot)}
                                                disabled={!slot.value.trim()}
                                                sx={{
                                                    p: 1
                                                }}
                                            >
                                                <CheckIcon fontSize="medium" />
                                            </IconButton>
                                        </motion.div>
                                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                            <IconButton
                                                size="medium"
                                                onClick={() => handleRemoveEditingSlot(slot.key)}
                                                sx={{
                                                    p: 1
                                                }}
                                            >
                                                <DeleteIcon fontSize="medium" />
                                            </IconButton>
                                        </motion.div>
                                    </Box>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </Box>

                    {/* New Slot Input */}
                    {isDialogueLevel && (
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                            <motion.div style={{ flex: '0 0 300px' }} whileHover={{ scale: 1.01 }}>
                                <TextField
                                    size="medium"
                                    label="新規スロット"
                                    value={newSlotKey}
                                    onChange={(e) => setNewSlotKey(e.target.value)}
                                    error={predefinedSlotKeys.includes(newSlotKey)}
                                    helperText={predefinedSlotKeys.includes(newSlotKey) ? "このスロットは既に存在します" : ""}
                                    sx={{
                                        width: '300px',
                                        '& .MuiInputBase-input': {
                                            fontSize: '1.1rem',
                                            py: isDialogueLevel ? 1 : 1.5,
                                            height: isDialogueLevel ? '32px' : '40px',
                                        },
                                        '& .MuiInputLabel-root': {
                                            fontSize: '1.1rem'
                                        }
                                    }}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && newSlotKey && !predefinedSlotKeys.includes(newSlotKey)) {
                                            handleAddNewSlot();
                                        }
                                    }}
                                />
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<AddIcon fontSize="medium" />}
                                    onClick={handleAddNewSlot}
                                    disabled={!newSlotKey || predefinedSlotKeys.includes(newSlotKey)}
                                    color={isDialogueLevel ? "secondary" : "primary"}
                                    size="large"
                                    sx={{
                                        fontSize: '1.1rem',
                                        py: isDialogueLevel ? 1 : 1.5,
                                        height: isDialogueLevel ? '40px' : '48px',
                                        minWidth: '120px'
                                    }}
                                >
                                    追加
                                </Button>
                            </motion.div>
                        </Stack>
                    )}
                </Box>
            </Stack>
        </MotionPaper>
    );
};

export default SlotIntentEditor;