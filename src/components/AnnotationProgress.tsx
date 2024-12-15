import React from 'react';
import {
    Box,
    LinearProgress,
    Typography,
    Paper,
    Stack,
    Chip
} from '@mui/material';
import { AnnotationProgress } from '../types';

interface AnnotationProgressProps {
    progress: AnnotationProgress;
    currentConversation?: {
        customerId: string;
        conversationId: string;
    };
}

const AnnotationProgressBar: React.FC<AnnotationProgressProps> = ({ progress, currentConversation }) => {
    const progressPercentage = (progress.completed / progress.total) * 100;

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
            <Stack spacing={2}>
                <Box>
                    <Typography variant="h6" gutterBottom>
                        アノテーション進捗
                    </Typography>
                    {currentConversation && (
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                            <Chip
                                label={
                                    <Typography sx={{ fontSize: '1.2rem' }}>
                                        {`顧客ID: ${currentConversation.customerId}`}
                                    </Typography>
                                }
                                color="primary"
                                variant="outlined"
                            />
                            <Chip
                                label={
                                    <Typography sx={{ fontSize: '1.2rem' }}>
                                        {`対話ID: ${currentConversation.conversationId}`}
                                    </Typography>
                                }
                                color="primary"
                                variant="outlined"
                            />
                        </Stack>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress
                                variant="determinate"
                                value={progressPercentage}
                                sx={{ height: 10, borderRadius: 5 }}
                            />
                        </Box>
                        <Box sx={{ minWidth: 35 }}>
                            <Typography variant="body2" color="text.secondary">
                                {`${Math.round(progressPercentage)}%`}
                            </Typography>
                        </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        {`${progress.completed} / ${progress.total} 完了`}
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
};

export default AnnotationProgressBar; 