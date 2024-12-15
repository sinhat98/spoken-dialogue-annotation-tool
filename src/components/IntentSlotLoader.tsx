import React, { useState } from 'react';
import {
    Box,
    Button,
    Typography,
    Stack
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface IntentSlotLoaderProps {
    onIntentsLoaded: (intents: string[]) => void;
    onSlotsLoaded: (slots: string[]) => void;
}

const IntentSlotLoader: React.FC<IntentSlotLoaderProps> = ({ onIntentsLoaded, onSlotsLoaded }) => {
    const [intentFileName, setIntentFileName] = useState<string>('');
    const [slotFileName, setSlotFileName] = useState<string>('');

    const handleIntentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIntentFileName(file.name);
            readFileContent(file, onIntentsLoaded);
        }
    };

    const handleSlotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSlotFileName(file.name);
            readFileContent(file, onSlotsLoaded);
        }
    };

    const readFileContent = (file: File, callback: (items: string[]) => void) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const items = text.split('\n').map((line) => line.trim()).filter((line) => line);
            callback(items);
        };
        reader.readAsText(file);
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                インテント・スロットファイルの読み込み
            </Typography>
            <Stack spacing={2}>
                <Box>
                    <Button
                        variant="outlined"
                        component="label"
                        startIcon={<CloudUploadIcon />}
                        fullWidth
                    >
                        インテントファイルを選択
                        <input
                            type="file"
                            hidden
                            accept=".txt"
                            onChange={handleIntentFileChange}
                        />
                    </Button>
                    {intentFileName && (
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            読み込んだインテントファイル: {intentFileName}
                        </Typography>
                    )}
                </Box>

                <Box>
                    <Button
                        variant="outlined"
                        component="label"
                        startIcon={<CloudUploadIcon />}
                        fullWidth
                    >
                        スロットファイルを選択
                        <input
                            type="file"
                            hidden
                            accept=".txt"
                            onChange={handleSlotFileChange}
                        />
                    </Button>
                    {slotFileName && (
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            読み込んだスロットファイル: {slotFileName}
                        </Typography>
                    )}
                </Box>
            </Stack>
        </Box>
    );
};

export default IntentSlotLoader;