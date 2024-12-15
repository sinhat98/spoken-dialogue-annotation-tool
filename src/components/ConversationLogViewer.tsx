import React from 'react';
import { Box, useTheme } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { motion } from 'framer-motion';
import { ConversationLog } from '../types';

interface ConversationLogViewerProps {
    logs: ConversationLog[];
}

const ConversationLogViewer: React.FC<ConversationLogViewerProps> = ({ logs }) => {
    const theme = useTheme();

    const columns: GridColDef[] = React.useMemo(() => {
        if (logs.length === 0) return [];
        return Object.keys(logs[0]).map((field) => ({
            field,
            headerName: field,
            flex: 1,
            minWidth: 150,
            renderCell: (params) => {
                const value = params.value;
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                return value;
            }
        }));
    }, [logs]);

    const rows = React.useMemo(() => {
        return logs.map((log, index) => ({
            id: index,
            ...log
        }));
    }, [logs]);

    const MotionBox = motion(Box);

    return (
        <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            sx={{
                height: 'calc(100vh - 300px)',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                overflow: 'hidden'
            }}
        >
            <DataGrid
                rows={rows}
                columns={columns}
                hideFooter
                disableRowSelectionOnClick
                density="comfortable"
                getRowHeight={() => 'auto'}
                sx={{
                    border: 'none',
                    '& .MuiDataGrid-cell': {
                        whiteSpace: 'normal',
                        padding: 1,
                        fontSize: '0.9rem',
                        borderColor: theme.palette.divider
                    },
                    '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: theme.palette.grey[100],
                        borderBottom: `2px solid ${theme.palette.divider}`
                    },
                    '& .MuiDataGrid-row': {
                        '&:nth-of-type(even)': {
                            backgroundColor: theme.palette.grey[50]
                        },
                        '&:hover': {
                            backgroundColor: theme.palette.action.hover
                        }
                    },
                    '& .MuiDataGrid-virtualScroller': {
                        overflow: 'auto !important',
                        '&::-webkit-scrollbar': {
                            width: '8px'
                        },
                        '&::-webkit-scrollbar-track': {
                            backgroundColor: theme.palette.grey[100]
                        },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: theme.palette.grey[400],
                            borderRadius: '4px',
                            '&:hover': {
                                backgroundColor: theme.palette.grey[500]
                            }
                        }
                    }
                }}
            />
        </MotionBox>
    );
};

export default ConversationLogViewer; 