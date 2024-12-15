import React, { useState, useCallback, useEffect } from 'react';
import {
  Container,
  Grid,
  Box,
  Button,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Divider,
  Stack,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { motion } from 'framer-motion';

import WaveformComponent from './components/WaveformComponent.tsx';
import ConversationLogViewer from './components/ConversationLogViewer.tsx';
import AnnotationProgressBar from './components/AnnotationProgress.tsx';
import SlotIntentEditor from './components/SlotIntentEditor.tsx';
import {
  ConversationData,
  ConversationLog,
  DialogueAnnotation,
  Segment,
  SlotValue,
  AnnotationProgress
} from './types/index.ts';
import {
  scanDirectory,
  loadAudioFile,
  loadConversationLogFile,
  readConversationLog,
  readTextFile,
  exportAnnotations
} from './utils/fileUtils.ts';

const App: React.FC = () => {
  // State for conversation data
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [conversationLogs, setConversationLogs] = useState<ConversationLog[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // State for annotation data
  const [annotations, setAnnotations] = useState<DialogueAnnotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<DialogueAnnotation | null>(null);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);

  // State for UI
  const [predefinedIntents, setPredefinedIntents] = useState<string[]>([]);
  const [predefinedSlotKeys, setPredefinedSlotKeys] = useState<string[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Progress tracking
  const progress: AnnotationProgress = {
    total: conversations.length,
    completed: annotations.length
  };

  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('xl'));
  const isMediumScreen = useMediaQuery(theme.breakpoints.up('lg'));

  // Handle directory selection
  const handleDirectorySelect = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      const conversationData = await scanDirectory(dirHandle);
      setConversations(conversationData);

      if (conversationData.length > 0) {
        setCurrentIndex(0);
        await loadConversation(conversationData[0]);
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  // Load conversation data
  const loadConversation = async (conversation: ConversationData) => {
    try {
      // Load audio file
      const audioFile = await loadAudioFile(conversation.audioFileHandle);
      setAudioFile(audioFile);

      // Load conversation log
      const logFile = await loadConversationLogFile(conversation.conversationLogHandle);
      const logs = await readConversationLog(logFile);
      setConversationLogs(logs);

      // Initialize or load annotation
      const existingAnnotation = annotations.find(
        a => a.customerId === conversation.customerId &&
          a.conversationId === conversation.conversationId
      );

      if (existingAnnotation) {
        setCurrentAnnotation(existingAnnotation);
        setCurrentTurnIndex(0);
      } else {
        setCurrentAnnotation({
          customerId: conversation.customerId,
          conversationId: conversation.conversationId,
          turns: [],
          dialogueSlots: []
        });
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  // Handle intent/slot list file upload
  const handleIntentFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const intents = await readTextFile(file);
      setPredefinedIntents(intents);
    }
  };

  const handleSlotKeysFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const slotKeys = await readTextFile(file);
      setPredefinedSlotKeys(slotKeys);
    }
  };

  // Navigation handlers
  const handleNext = async () => {
    if (currentIndex < conversations.length - 1) {
      setCurrentIndex(currentIndex + 1);
      await loadConversation(conversations[currentIndex + 1]);
    }
  };

  const handlePrevious = async () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      await loadConversation(conversations[currentIndex - 1]);
    }
  };
  // Annotation handlers
  const handleMarkerSet = (segments: Segment[]) => {
    if (!currentAnnotation) return;

    // 既存のターンを保持
    const existingTurns = currentAnnotation.turns.map(turn => ({
      ...turn,
      segments: [{ start: turn.segments[0].start, end: turn.segments[0].end }]
    }));

    // 新しいセグメントに基づいてターンを更新
    const newTurns = segments.map((segment, index) => {
      const existingTurn = existingTurns[index] || {
        segments: [],
        intent: '',
        slots: []
      };

      return {
        ...existingTurn,
        segments: [{
          start: segment.start,
          end: segment.end
        }]
      };
    });

    const newAnnotation = {
      ...currentAnnotation,
      turns: newTurns
    };

    setCurrentAnnotation(newAnnotation);
  };

  const handleMarkerSelect = (index: number) => {
    setCurrentTurnIndex(index);
  };

  const handleIntentChange = (intent: string) => {
    if (!currentAnnotation) return;

    const newTurns = [...currentAnnotation.turns];
    newTurns[currentTurnIndex] = {
      ...newTurns[currentTurnIndex],
      intent
    };

    setCurrentAnnotation({
      ...currentAnnotation,
      turns: newTurns
    });
  };

  const handleTurnSlotsChange = (slots: SlotValue[]) => {
    if (!currentAnnotation) return;

    const newTurns = [...currentAnnotation.turns];
    newTurns[currentTurnIndex] = {
      ...newTurns[currentTurnIndex],
      slots
    };

    setCurrentAnnotation({
      ...currentAnnotation,
      turns: newTurns
    });
  };

  const handleDialogueSlotsChange = (slots: SlotValue[]) => {
    if (!currentAnnotation) return;

    setCurrentAnnotation({
      ...currentAnnotation,
      dialogueSlots: slots
    });
  };

  // Save and export handlers
  const handleSave = () => {
    if (!currentAnnotation) return;

    const newAnnotations = [...annotations];
    const index = annotations.findIndex(
      a => a.customerId === currentAnnotation.customerId &&
        a.conversationId === currentAnnotation.conversationId
    );

    if (index >= 0) {
      newAnnotations[index] = currentAnnotation;
    } else {
      newAnnotations.push(currentAnnotation);
    }

    setAnnotations(newAnnotations);
    setShowSaveDialog(true);
  };

  const handleExport = () => {
    const csv = exportAnnotations(annotations);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: theme.palette.background.default
    }}>
      {/* Main Content */}
      <Box sx={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="flex-start"
            justifyContent="space-between"
          >
            {/* Left side - Directory selection and Turn Annotation */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<FolderOpenIcon />}
                onClick={handleDirectorySelect}
                sx={{
                  py: 2,
                  px: 4,
                  fontSize: '1.4rem',
                  fontWeight: 'bold',
                  alignSelf: 'flex-start'
                }}
              >
                ディレクトリを選択
              </Button>

              {/* Turn Annotation Section */}
              <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden'
              }}>
                {/* Header */}
                <Box sx={{
                  p: 2.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flex: 1
                  }}>
                    <Typography variant="h5" sx={{
                      fontWeight: 'bold',
                      fontSize: '1.8rem',
                      letterSpacing: '0.5px',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                    }}>
                      ターンアノテーション
                    </Typography>
                    {currentAnnotation && currentAnnotation.turns.length > 0 && (
                      <Typography variant="h6" sx={{
                        fontSize: '1.2rem',
                        opacity: 0.9,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        Turn {currentTurnIndex + 1} / {currentAnnotation.turns.length}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      color="inherit"
                      size="small"
                      onClick={() => currentTurnIndex > 0 && setCurrentTurnIndex(currentTurnIndex - 1)}
                      disabled={!currentAnnotation || currentTurnIndex <= 0}
                      sx={{
                        minWidth: 40,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.2)'
                        }
                      }}
                    >
                      ←
                    </Button>
                    <Button
                      variant="contained"
                      color="inherit"
                      size="small"
                      onClick={() => currentAnnotation && currentTurnIndex < currentAnnotation.turns.length - 1 && setCurrentTurnIndex(currentTurnIndex + 1)}
                      disabled={!currentAnnotation || currentTurnIndex >= currentAnnotation.turns.length - 1}
                      sx={{
                        minWidth: 40,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.2)'
                        }
                      }}
                    >
                      →
                    </Button>
                  </Stack>
                </Box>

                {/* Waveform Section */}
                <Box sx={{
                  p: 2.5,
                  flex: '0 0 auto',
                  bgcolor: 'grey.50',
                  borderBottom: '1px solid',
                  borderColor: 'divider'
                }}>
                  {audioFile && currentAnnotation && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <WaveformComponent
                        audioFile={audioFile}
                        onMarkerSet={handleMarkerSet}
                        onMarkerSelect={handleMarkerSelect}
                        selectedTurnIndex={currentTurnIndex}
                        segments={currentAnnotation.turns.map(turn => turn.segments[0])}
                      />
                    </motion.div>
                  )}
                </Box>

                {/* Annotation Section */}
                <Box sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 2.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default'
                }}>
                  {currentAnnotation && currentAnnotation.turns[currentTurnIndex] ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <SlotIntentEditor
                        turnIndex={currentTurnIndex}
                        intent={currentAnnotation.turns[currentTurnIndex].intent}
                        slots={currentAnnotation.turns[currentTurnIndex].slots}
                        predefinedIntents={predefinedIntents}
                        predefinedSlotKeys={predefinedSlotKeys}
                        onIntentChange={handleIntentChange}
                        onSlotsChange={handleTurnSlotsChange}
                      />
                    </motion.div>
                  ) : (
                    <Box sx={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.secondary'
                    }}>
                      <Typography variant="h6">
                        ターンが選択されていません
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Right side - Progress, Dialogue Slots, and file uploads */}
            <Stack spacing={2} sx={{ minWidth: 300, flex: 1 }}>
              <AnnotationProgressBar
                progress={progress}
                currentConversation={currentAnnotation ? {
                  customerId: currentAnnotation.customerId,
                  conversationId: currentAnnotation.conversationId
                } : undefined}
              />
              {currentAnnotation && (
                <SlotIntentEditor
                  isDialogueLevel={true}
                  dialogueSlots={currentAnnotation.dialogueSlots}
                  predefinedSlotKeys={predefinedSlotKeys}
                  onDialogueSlotsChange={handleDialogueSlotsChange}
                />
              )}
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<FileUploadIcon />}
                  component="label"
                  sx={{
                    py: 1.5,
                    px: 2,
                    fontSize: '1.3rem'
                  }}
                >
                  インテントリスト
                  <input
                    type="file"
                    hidden
                    accept=".txt"
                    onChange={handleIntentFileUpload}
                  />
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<FileUploadIcon />}
                  component="label"
                  sx={{
                    py: 1.5,
                    px: 2,
                    fontSize: '1.3rem'
                  }}
                >
                  スロットリスト
                  <input
                    type="file"
                    hidden
                    accept=".txt"
                    onChange={handleSlotKeysFileUpload}
                  />
                </Button>
              </Stack>
              {/* Conversation Log moved here */}
              <Box sx={{
                flex: 1,
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Box sx={{
                  p: 2.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.secondary.dark} 90%)`,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}>
                  <Typography variant="h5" sx={{
                    fontWeight: 'bold',
                    fontSize: '1.8rem',
                    letterSpacing: '0.5px',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }}>
                    対話ログ
                  </Typography>
                </Box>
                <Box sx={{
                  flex: 1,
                  overflow: 'hidden',
                  bgcolor: 'grey.50'
                }}>
                  <ConversationLogViewer logs={conversationLogs} />
                </Box>
              </Box>
            </Stack>
          </Stack>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{
        p: 2.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)'
      }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="large"
              startIcon={<NavigateBeforeIcon sx={{ fontSize: '2rem' }} />}
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              sx={{
                fontSize: '1.4rem',
                py: 1.5,
                px: 4,
                color: theme.palette.text.primary,
                '&:not(:disabled)': {
                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.1)'
                  }
                }
              }}
            >
              前の会話
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="contained"
              size="large"
              startIcon={<SaveIcon sx={{ fontSize: '2rem' }} />}
              onClick={handleSave}
              disabled={!currentAnnotation}
              sx={{
                fontSize: '1.5rem',
                py: 2,
                px: 6,
                fontWeight: 'bold',
                background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`,
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
                '&:hover': {
                  boxShadow: '0 6px 15px rgba(0, 0, 0, 0.3)'
                }
              }}
            >
              保存
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              size="large"
              endIcon={<NavigateNextIcon sx={{ fontSize: '2rem' }} />}
              onClick={handleNext}
              disabled={currentIndex === conversations.length - 1}
              sx={{
                fontSize: '1.4rem',
                py: 1.5,
                px: 4,
                color: theme.palette.text.primary,
                '&:not(:disabled)': {
                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.1)'
                  }
                }
              }}
            >
              次の会話
            </Button>
          </motion.div>
        </Stack>
      </Box>

      {/* Save Dialog */}
      <Dialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }
        }}
      >
        <DialogTitle sx={{
          fontSize: '1.8rem',
          fontWeight: 'bold',
          color: theme.palette.primary.main,
          pb: 1
        }}>
          アノテーションを保存しました
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{
            fontSize: '1.4rem',
            color: theme.palette.text.secondary
          }}>
            アノテーションを保存しました。エクスポートしますか？
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setShowSaveDialog(false)}
            size="large"
            sx={{
              fontSize: '1.3rem',
              color: theme.palette.text.secondary
            }}
          >
            閉じる
          </Button>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleExport}
              variant="contained"
              size="large"
              sx={{
                fontSize: '1.3rem',
                fontWeight: 'bold',
                background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`,
                px: 4
              }}
            >
              エクスポート
            </Button>
          </motion.div>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default App;