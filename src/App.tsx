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
  LinearProgress,
  Autocomplete,
  TextField,
  IconButton
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion } from 'framer-motion';
import { useSnackbar } from 'notistack';

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
  exportAnnotations,
  saveAnnotation,
  loadAnnotation,
  clearCache
} from './utils/fileUtils.ts';
import SlotIntentContainer from './components/SlotIntentContainer.tsx';

const App: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  // State for conversation data
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [conversationLogs, setConversationLogs] = useState<ConversationLog[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

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
    completed: annotations.filter(annotation =>
      // インテントが設定されているか、ターンにインテントが設定されているものをカウント
      annotation.intent ||
      annotation.turns.some(turn => turn.intent)
    ).length
  };

  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('xl'));
  const isMediumScreen = useMediaQuery(theme.breakpoints.up('lg'));

  // Handle directory selection
  const handleDirectorySelect = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      setDirectoryHandle(dirHandle);
      const conversationData = await scanDirectory(dirHandle);
      setConversations(conversationData);

      // intent.txtとslot.txtの読み込み
      try {
        const intentFileHandle = await dirHandle.getFileHandle('intent.txt');
        const slotFileHandle = await dirHandle.getFileHandle('slot.txt');

        const intentFile = await intentFileHandle.getFile();
        const slotFile = await slotFileHandle.getFile();

        const intents = await readTextFile(intentFile);
        const slots = await readTextFile(slotFile);

        setPredefinedIntents(intents);
        setPredefinedSlotKeys(slots);
      } catch (error) {
        console.log('intent.txt or slot.txt not found in directory');
      }

      // 既存のアノテーションを読み込む
      const loadedAnnotations: DialogueAnnotation[] = [];
      for (const conversation of conversationData) {
        const savedAnnotation = await loadAnnotation(
          conversation.customerId,
          conversation.conversationId,
          dirHandle
        );
        if (savedAnnotation) {
          loadedAnnotations.push(savedAnnotation);
        }
      }
      setAnnotations(loadedAnnotations);

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
      // 現在のアノテーションを保存
      await autoSaveAnnotation();
      // 次の会話へ移動
      setCurrentIndex(currentIndex + 1);
      // 次の会話データを読み込む
      await loadConversation(conversations[currentIndex + 1]);
    }
  };

  const handlePrevious = async () => {
    if (currentIndex > 0) {
      // 現在のアノテーションを保存
      await autoSaveAnnotation();
      // 前の会話へ移動
      setCurrentIndex(currentIndex - 1);
      // 前の会話データを読み込む
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

  const handleIntentChange = useCallback((intent: string, turnIndex: number) => {
    if (!currentAnnotation) return;

    setCurrentAnnotation(prev => {
      if (!prev) return prev;
      const newTurns = [...prev.turns];
      newTurns[turnIndex] = {
        ...newTurns[turnIndex],
        intent
      };
      return {
        ...prev,
        turns: newTurns
      };
    });
  }, []);

  const handleTurnSlotsChange = (slots: SlotValue[], turnIndex: number) => {
    if (!currentAnnotation) return;

    // ターンのスロットを更新
    const newTurns = [...currentAnnotation.turns];
    newTurns[turnIndex] = {
      ...newTurns[turnIndex],
      slots
    };

    // 対話全体のスロットを更新（ターンのスロットと同期を保つ）
    const allTurnSlots = newTurns.flatMap(turn => turn.slots);
    const uniqueDialogueSlots = allTurnSlots.filter((slot, index, self) =>
      index === self.findIndex(s => s.key === slot.key && s.value === slot.value)
    );

    setCurrentAnnotation({
      ...currentAnnotation,
      turns: newTurns,
      dialogueSlots: uniqueDialogueSlots
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
  const handleSave = async () => {
    if (!currentAnnotation) return;

    // 現在のアノテーションを保存
    await saveCurrentAnnotation();

    // annotationsステートを更新
    const newAnnotations = [...annotations];
    const index = newAnnotations.findIndex(
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

  // 現在のアノテーションを保存する関数
  const saveCurrentAnnotation = async () => {
    if (!currentAnnotation || !directoryHandle) return;

    const annotationData: DialogueAnnotation = {
      customerId: currentAnnotation.customerId,
      conversationId: currentAnnotation.conversationId,
      turns: currentAnnotation.turns,
      dialogueSlots: currentAnnotation.dialogueSlots
    };

    try {
      await saveAnnotation(currentAnnotation.customerId, currentAnnotation.conversationId, annotationData, directoryHandle);
      console.log('Annotation saved successfully');
    } catch (error) {
      console.error('Failed to save annotation:', error);
    }
  };

  // 会話を切り替える際の処理を更新
  const handleNavigateConversation = async (direction: 'prev' | 'next') => {
    if (!directoryHandle) return;

    if (currentAnnotation) {
      // 現在のアノテーションを保存
      await saveCurrentAnnotation();

      // annotationsステートを更新
      const newAnnotations = [...annotations];
      const index = newAnnotations.findIndex(
        a => a.customerId === currentAnnotation.customerId &&
          a.conversationId === currentAnnotation.conversationId
      );
      if (index >= 0) {
        newAnnotations[index] = currentAnnotation;
      } else {
        newAnnotations.push(currentAnnotation);
      }
      setAnnotations(newAnnotations);
    }

    // インデックスを更新
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < conversations.length) {
      setCurrentIndex(newIndex);
      await loadConversation(conversations[newIndex]);

      // 新しいファイルのアノテーションを読み込む
      const savedAnnotation = await loadAnnotation(
        conversations[newIndex].customerId,
        conversations[newIndex].conversationId,
        directoryHandle
      );
      if (savedAnnotation) {
        setCurrentAnnotation(savedAnnotation);
        setCurrentTurnIndex(0);
      } else {
        setCurrentAnnotation({
          customerId: conversations[newIndex].customerId,
          conversationId: conversations[newIndex].conversationId,
          turns: [],
          dialogueSlots: []
        });
      }
    }
  };

  // ターン削除のハンドラーを追加
  const handleDeleteTurn = (index: number) => {
    if (!currentAnnotation) return;

    const newTurns = [...currentAnnotation.turns];
    newTurns.splice(index, 1);  // 指定されたインデックスのターンを削除

    setCurrentAnnotation({
      ...currentAnnotation,
      turns: newTurns
    });

    // 現在選択中のターンが削除された場合、選択を解除
    if (currentTurnIndex === index) {
      setCurrentTurnIndex(0);
    } else if (currentTurnIndex > index) {
      // 削除されたターンより後ろを選択していた場合、インデックスを1つ戻す
      setCurrentTurnIndex(currentTurnIndex - 1);
    }
  };

  // ターン一覧のUIコンポーネント
  const TurnList: React.FC = () => {
    if (!currentAnnotation) return null;

    return (
      <Box sx={{
        flex: 1,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        p: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Typography variant="h6" gutterBottom sx={{ fontSize: '1.5rem', mb: 2 }}>
          ターン一覧: {currentAnnotation.turns.length}個
        </Typography>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Stack spacing={2}>
            {currentAnnotation.turns.map((turn, index) => (
              <Paper
                key={index}
                elevation={1}
                sx={{
                  bgcolor: index === currentTurnIndex ? 'rgba(25, 118, 210, 0.08)' : 'background.paper',
                  '&:hover': {
                    bgcolor: 'rgba(25, 118, 210, 0.12)'
                  }
                }}
              >
                {/* ターンヘッダー */}
                <Box
                  sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => handleMarkerSelect(index)}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="h6" sx={{ fontSize: '1.4rem', fontWeight: 'bold', minWidth: '120px' }}>
                      ターン {index + 1}
                    </Typography>
                    <Typography color="success.main" sx={{ fontSize: '1.1rem', minWidth: '150px' }}>
                      開始: {turn.segments[0].start.toFixed(2)}秒
                    </Typography>
                    <Typography color="error.main" sx={{ fontSize: '1.1rem', minWidth: '150px' }}>
                      終了: {turn.segments[0].end.toFixed(2)}秒
                    </Typography>
                  </Stack>
                  <IconButton
                    size="medium"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTurn(index);
                    }}
                    sx={{
                      '&:hover': {
                        bgcolor: 'error.light'
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>

                {/* アノテーション部分 */}
                <Box sx={{ p: 2, bgcolor: 'rgba(25, 118, 210, 0.02)' }}>
                  <Stack spacing={2}>
                    {/* インテントとスロットの編集 */}
                    <SlotIntentContainer
                      predefinedSlotKeys={predefinedSlotKeys}
                      predefinedIntents={predefinedIntents}
                      initialSlots={turn.slots}
                      initialIntent={turn.intent}
                      onSlotsUpdate={(newSlots) => {
                        // ターンのスロットを更新
                        const newTurns = [...currentAnnotation.turns];
                        newTurns[index] = {
                          ...newTurns[index],
                          slots: newSlots
                        };

                        // 対話レベルのスロットも更新
                        const allTurnSlots = newTurns.flatMap(turn => turn.slots);
                        const uniqueDialogueSlots = allTurnSlots.filter((slot, idx, self) =>
                          idx === self.findIndex(s => s.key === slot.key && s.value === slot.value)
                        );

                        setCurrentAnnotation({
                          ...currentAnnotation,
                          turns: newTurns,
                          dialogueSlots: uniqueDialogueSlots
                        });
                      }}
                      onIntentUpdate={(newIntent) => {
                        const newTurns = [...currentAnnotation.turns];
                        newTurns[index] = {
                          ...newTurns[index],
                          intent: newIntent
                        };
                        setCurrentAnnotation({
                          ...currentAnnotation,
                          turns: newTurns
                        });
                      }}
                    />
                  </Stack>
                </Box>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Box>
    );
  };

  // 自動保存関数を修正
  const autoSaveAnnotation = async () => {
    if (currentAnnotation && directoryHandle) {
      try {
        await saveAnnotation(
          currentAnnotation.customerId,
          currentAnnotation.conversationId,
          currentAnnotation,
          directoryHandle
        );

        // annotations配列を更新
        setAnnotations(prevAnnotations => {
          const index = prevAnnotations.findIndex(
            a => a.customerId === currentAnnotation.customerId &&
              a.conversationId === currentAnnotation.conversationId
          );

          if (index >= 0) {
            // 既存のアノテーションを更新
            const newAnnotations = [...prevAnnotations];
            newAnnotations[index] = currentAnnotation;
            return newAnnotations;
          } else {
            // 新しいアノテーションを追加
            return [...prevAnnotations, currentAnnotation];
          }
        });

        enqueueSnackbar('アノテーションを自動保存しました', {
          variant: 'success',
          autoHideDuration: 2000,
          anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
        });
      } catch (error) {
        console.error('Failed to auto-save annotation:', error);
        enqueueSnackbar('自動保存に失敗しました', {
          variant: 'error',
          autoHideDuration: 2000,
          anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
        });
      }
    }
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
      {/* Main Content Area */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        p: 2,
        // フッターの高さ分の余白を削除
        pb: 0
      }}>
        {/* Header */}
        <Box sx={{
          mb: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          alignItems: 'center'
        }}>
          {/* ディレクトリ選択ボタン */}
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
            }}
          >
            ディレクトリを選択
          </Button>

          {/* Progress */}
          <Box sx={{
            flex: 1,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            p: 2
          }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                アノテーション進捗: {progress.completed} / {progress.total}
              </Typography>
              {currentAnnotation && (
                <Stack direction="row" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    顧客ID: {currentAnnotation.customerId}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    対話ID: {currentAnnotation.conversationId}
                  </Typography>
                </Stack>
              )}
              <LinearProgress
                variant="determinate"
                value={(progress.completed / progress.total) * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Stack>
          </Box>

          {/* Dialogue Level Slots */}
          {currentAnnotation && (
            <Box sx={{
              flex: 1,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              maxHeight: '200px'
            }}>
              <Box sx={{
                p: 1,
                background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.secondary.dark} 90%)`,
                color: 'white'
              }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  対話レベルスロット
                </Typography>
              </Box>
              <Box sx={{ p: 2, overflow: 'auto' }}>
                <SlotIntentContainer
                  isDialogueLevel={true}
                  predefinedSlotKeys={predefinedSlotKeys}
                  predefinedIntents={predefinedIntents}
                  initialSlots={currentAnnotation.dialogueSlots}
                  initialIntent={currentAnnotation.intent || ''}
                  onSlotsUpdate={(newSlots) => {
                    if (currentAnnotation) {
                      setCurrentAnnotation({
                        ...currentAnnotation,
                        dialogueSlots: newSlots
                      });
                    }
                  }}
                  onIntentUpdate={(newIntent) => {
                    if (currentAnnotation) {
                      setCurrentAnnotation({
                        ...currentAnnotation,
                        intent: newIntent
                      });
                    }
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* Content Area - 上部のStackを削除してメインコンテンツ領域を拡大 */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'hidden',
          p: 2,
          pb: '80px'
        }}>
          {/* Main Content Area - Split into two columns */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            gap: 2,
            overflow: 'hidden',
          }}>
            {/* Left Column - Waveform and Turn List */}
            <Box sx={{
              flex: '2 1 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflow: 'hidden',
              minWidth: 0
            }}>
              {/* Waveform */}
              <Box sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              }}>
                {audioFile && (
                  <WaveformComponent
                    audioFile={audioFile}
                    onMarkerSet={handleMarkerSet}
                    onMarkerSelect={handleMarkerSelect}
                    selectedTurnIndex={currentTurnIndex}
                    segments={currentAnnotation?.turns.map(turn => turn.segments[0]) || []}
                  />
                )}
              </Box>

              {/* Turn List - 残りの空間を全て使用 */}
              <Box sx={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <TurnList />
              </Box>
            </Box>

            {/* Right Column - Conversation Log */}
            <Box sx={{
              flex: '1 1 0',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0
            }}>
              <Box sx={{
                p: 1.5,
                background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.secondary.dark} 90%)`,
                color: 'white'
              }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  対話ログ
                </Typography>
              </Box>
              <Box sx={{
                flex: 1,
                overflow: 'auto',
                p: 2
              }}>
                <ConversationLogViewer logs={conversationLogs} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)',
          zIndex: 1000,
          p: 2
        }}
      >
        <Box sx={{
          borderTop: 1,
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'background.paper'
        }}>
          {/* 左側のナビゲーションボタン */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<NavigateBeforeIcon />}
              onClick={handlePrevious}
              disabled={currentIndex <= 0}
            >
              前へ
            </Button>
            <Button
              variant="outlined"
              endIcon={<NavigateNextIcon />}
              onClick={handleNext}
              disabled={currentIndex >= conversations.length - 1}
            >
              次へ
            </Button>
          </Box>

          {/* 中央の保存ボタン */}
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={() => setShowSaveDialog(true)}
            disabled={!currentAnnotation}
          >
            保存
          </Button>

          {/* 右側のキャッシュクリアボタン */}
          <Button
            variant="outlined"
            color="warning"
            onClick={async () => {
              if (!directoryHandle) return;

              const result = await clearCache(directoryHandle);
              if (result) {
                enqueueSnackbar('キャッシュを削除しました', {
                  variant: 'success',
                  autoHideDuration: 2000,
                  anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
                });
              } else {
                enqueueSnackbar('キャッシュの削除に失敗しました', {
                  variant: 'error',
                  autoHideDuration: 2000,
                  anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
                });
              }
            }}
            disabled={!directoryHandle}
          >
            キャッシュクリア
          </Button>
        </Box>
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