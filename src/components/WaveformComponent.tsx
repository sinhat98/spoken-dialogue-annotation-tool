import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Box, Button, Stack, Typography, Paper, Snackbar, Slider } from '@mui/material';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js';
import MarkerPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.markers.min.js';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import EditIcon from '@mui/icons-material/Edit';
import StopIcon from '@mui/icons-material/Stop';
import FlagIcon from '@mui/icons-material/Flag';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { motion } from 'framer-motion';
import { Segment } from '../types';

interface WaveformProps {
    audioFile: File;
    onMarkerSet: (segments: Segment[]) => void;
    onMarkerSelect: (index: number) => void;
    selectedTurnIndex: number;
    segments: Segment[];
}

const WaveformComponent: React.FC<WaveformProps> = ({
    audioFile,
    onMarkerSet,
    onMarkerSelect,
    selectedTurnIndex,
    segments
}) => {
    const waveformRef = useRef<HTMLDivElement | null>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [duration, setDuration] = useState<number>(0);
    const [isAnnotationMode, setIsAnnotationMode] = useState(false);
    const [showMarkerFeedback, setShowMarkerFeedback] = useState(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [hasUnsavedMarkerChanges, setHasUnsavedMarkerChanges] = useState(false);
    const [tempMarkers, setTempMarkers] = useState<{ start?: number; end?: number }>({});
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const MAX_ZOOM = 10;
    const MIN_ZOOM = 1;
    const ZOOM_STEP = 0.1;

    const updateMarkersDisplay = useCallback((ws: WaveSurfer, segments: Segment[], preserveExisting: boolean = false) => {
        if (!preserveExisting) {
            ws.clearMarkers();
            ws.clearRegions();
        }

        segments.forEach((segment, index) => {
            // 発話区間の領域を追加（開始から終了までの区間）
            ws.addRegion({
                start: segment.start,
                end: segment.end,
                color: index === selectedTurnIndex ? 'rgba(76, 175, 80, 0.15)' : 'rgba(129, 199, 132, 0.1)',
                drag: false,
                resize: false,
            });

            // 発話終了アノテーション区間の領域を追加（終了時刻の前後100ms）
            const annotationStart = Math.max(segment.end - 0.1, segment.start);  // 発話区間と重ならないように
            const annotationEnd = Math.min(ws.getDuration(), segment.end + 0.1);
            ws.addRegion({
                start: annotationStart,
                end: annotationEnd,
                color: index === selectedTurnIndex ? 'rgba(255, 0, 0, 0.15)' : 'rgba(100, 100, 100, 0.1)',
                drag: false,
                resize: false,
            });

            // 発話開始マーカー
            ws.addMarker({
                time: segment.start,
                label: `発話開始 ${index + 1}`,
                color: index === selectedTurnIndex ? '#4CAF50' : '#999999',
                position: 'top',
                draggable: isAnnotationMode,
                preventContextMenu: true,
                labelStyle: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '4px',
                    top: '-30px'
                },
                markerStyle: {
                    width: '4px',
                    height: '20px'
                }
            });

            // 発話終了マーカー
            ws.addMarker({
                time: segment.end,
                label: `発話終了 ${index + 1}`,
                color: index === selectedTurnIndex ? '#ff0000' : '#999999',
                position: 'top',
                draggable: isAnnotationMode,
                preventContextMenu: true,
                labelStyle: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '4px',
                    top: '-30px'
                },
                markerStyle: {
                    width: '4px',
                    height: '20px'
                }
            });
        });

        // 一時マーカーの表示
        if (tempMarkers.start !== undefined) {
            ws.addMarker({
                time: tempMarkers.start,
                label: '一時マーカー (開始)',
                color: '#4CAF50',
                position: 'top',
                draggable: true,
                preventContextMenu: true,
                labelStyle: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '4px',
                    top: '-30px'
                },
                markerStyle: {
                    width: '4px',
                    height: '20px'
                }
            });
        }
        if (tempMarkers.end !== undefined) {
            ws.addMarker({
                time: tempMarkers.end,
                label: '一時マーカー (終了)',
                color: '#999999',
                position: 'top',
                draggable: true,
                preventContextMenu: true,
                labelStyle: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '4px',
                    top: '-30px'
                },
                markerStyle: {
                    width: '4px',
                    height: '20px'
                }
            });
        }
    }, [selectedTurnIndex, isAnnotationMode, tempMarkers]);

    const handlePlayPause = useCallback(() => {
        if (wavesurfer.current && isReady) {
            wavesurfer.current.playPause();
        }
    }, [isReady]);

    const handleAddMarkerAtCurrentTime = useCallback(() => {
        if (!wavesurfer.current || !isAnnotationMode) return;

        const time = wavesurfer.current.getCurrentTime();
        const ws = wavesurfer.current;

        // 既存の一時マーカーを取得
        const existingStartMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (開始)');
        const existingEndMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (終了)');

        if (!existingStartMarker) {
            // 発話開始マーカーを追加
            ws.addMarker({
                time: time,
                label: '一時マーカー (開始)',
                color: '#4CAF50',
                position: 'top',
                draggable: true,
                preventContextMenu: true,
                labelStyle: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '4px',
                    top: '-30px'
                },
                markerStyle: {
                    width: '4px',
                    height: '20px'
                }
            });
        } else if (!existingEndMarker) {
            // 発話終了マーカーを追加（開始マーカーより後の時間のみ）
            if (time > existingStartMarker.time) {
                ws.addMarker({
                    time: time,
                    label: '一時マーカー (終了)',
                    color: '#999999',
                    position: 'top',
                    draggable: true,
                    preventContextMenu: true,
                    labelStyle: {
                        fontSize: '16px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '4px',
                        top: '-30px'
                    },
                    markerStyle: {
                        width: '4px',
                        height: '20px'
                    }
                });
            }
        }

        // マーカーの状態を再確認して確定ボタンの有効状態を更新
        const updatedStartMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (開始)');
        const updatedEndMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (終了)');
        setHasUnsavedMarkerChanges(updatedStartMarker !== undefined && updatedEndMarker !== undefined);
    }, [isAnnotationMode]);

    const handleDeleteMarker = useCallback((index: number) => {
        if (!wavesurfer.current) return;
        const newSegments = segments.filter((_, i) => i !== index);
        onMarkerSet(newSegments);
    }, [segments, onMarkerSet]);

    const handleConfirmMarkerPositions = useCallback(() => {
        if (wavesurfer.current) {
            const ws = wavesurfer.current;
            let updatedSegments = [...segments];
            let hasChanges = false;

            // 既存のマーカーの位置を更新
            const existingMarkers = Object.values(ws.markers.markers || {}).filter((marker: any) =>
                marker.label?.startsWith('発話開始') || marker.label?.startsWith('発話終了')
            );

            existingMarkers.forEach((marker: any) => {
                const matchStart = marker.label?.match(/発話開始 (\d+)/);
                const matchEnd = marker.label?.match(/発話終了 (\d+)/);
                if (matchStart || matchEnd) {
                    const index = parseInt((matchStart?.[1] || matchEnd?.[1]) as string) - 1;
                    if (index >= 0 && index < segments.length) {
                        if (matchStart && Math.abs(updatedSegments[index].start - marker.time) > 0.001) {
                            updatedSegments[index] = { ...updatedSegments[index], start: marker.time };
                            hasChanges = true;
                        }
                        if (matchEnd && Math.abs(updatedSegments[index].end - marker.time) > 0.001) {
                            updatedSegments[index] = { ...updatedSegments[index], end: marker.time };
                            hasChanges = true;
                        }
                    }
                }
            });

            // 一時マーカーを処理
            const tempStartMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (開始)');
            const tempEndMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (終了)');

            if (tempStartMarker && tempEndMarker) {
                const newSegment: Segment = {
                    start: tempStartMarker.time,
                    end: tempEndMarker.time
                };

                // 新しいセグメントを時間順に挿入
                const insertIndex = updatedSegments.findIndex(segment => segment.start > newSegment.start);

                // 新しいセグメントの配列を作成
                const newSegments = insertIndex === -1
                    ? [...updatedSegments, newSegment]  // 末尾に追加
                    : [
                        ...updatedSegments.slice(0, insertIndex),
                        newSegment,
                        ...updatedSegments.slice(insertIndex)
                    ];  // 途中に挿入

                updatedSegments = newSegments;
                hasChanges = true;
            }

            if (hasChanges) {
                // セグメントを時間順にソート
                updatedSegments.sort((a, b) => a.start - b.start);

                onMarkerSet(updatedSegments);
                setHasUnsavedMarkerChanges(false);
                setShowMarkerFeedback(true);

                ws.clearMarkers();
                ws.clearRegions();
                updateMarkersDisplay(ws, updatedSegments);

                if (tempStartMarker && tempEndMarker) {
                    const newIndex = updatedSegments.findIndex(segment =>
                        Math.abs(segment.start - tempStartMarker.time) < 0.001 &&
                        Math.abs(segment.end - tempEndMarker.time) < 0.001
                    );
                    if (newIndex !== -1) {
                        onMarkerSelect(newIndex);
                    }
                }
            }

            // 一時マーカーの状態をリセット
            setTempMarkers({});
        }
    }, [segments, onMarkerSet, updateMarkersDisplay, onMarkerSelect]);

    const handleClick = (time: number) => {
        if (!wavesurfer.current || !isAnnotationMode) return;
        const ws = wavesurfer.current;

        // 既存の一時マーカーを取得
        const existingStartMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (開始)');
        const existingEndMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (終了)');

        if (!existingStartMarker) {
            // 発話開始マーカーを追加
            ws.addMarker({
                time: time,
                label: '一時マーカー (開始)',
                color: '#4CAF50',
                position: 'top',
                draggable: true,
                preventContextMenu: true,
                labelStyle: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '4px',
                    top: '-30px'
                },
                markerStyle: {
                    width: '4px',
                    height: '20px'
                }
            });
        } else if (!existingEndMarker) {
            // 発話終了マーカーを追加（開始マーカーより後の時間のみ）
            if (time > existingStartMarker.time) {
                ws.addMarker({
                    time: time,
                    label: '一時マーカー (終了)',
                    color: '#999999',
                    position: 'top',
                    draggable: true,
                    preventContextMenu: true,
                    labelStyle: {
                        fontSize: '16px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '4px',
                        top: '-30px'
                    },
                    markerStyle: {
                        width: '4px',
                        height: '20px'
                    }
                });
            }
        }

        // マーカーの状態を再確認して確定ボタンの効状態を更新
        const updatedStartMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (開始)');
        const updatedEndMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (終了)');
        setHasUnsavedMarkerChanges(updatedStartMarker !== undefined && updatedEndMarker !== undefined);
    };

    const handleMarkerDrag = (marker: any) => {
        if (!wavesurfer.current) return;
        const ws = wavesurfer.current;

        // 一時マーカーの視覚的な位置のみを更新
        if (marker.label === '一時マーカー (開始)') {
            const endMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (終了)');
            marker.time = Math.min(marker.time, endMarker?.time || Infinity);
        } else if (marker.label === '一時マーカー (終了)') {
            const startMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (開始)');
            marker.time = Math.max(marker.time, startMarker?.time || 0);
        }

        // 既存のマーカーの視覚的な位置のみを更新
        const matchStart = marker.label?.match(/発話開始 (\d+)/);
        const matchEnd = marker.label?.match(/発話終了 (\d+)/);

        if (matchStart || matchEnd) {
            const index = parseInt((matchStart?.[1] || matchEnd?.[1]) as string) - 1;
            if (index >= 0 && index < segments.length) {
                // 発話開始マーカーの場合
                if (matchStart) {
                    marker.color = index === selectedTurnIndex ? '#4CAF50' : '#999999';
                    marker.time = Math.min(marker.time, segments[index].end);
                }
                // 発話終了マーカーの場合
                if (matchEnd) {
                    marker.color = index === selectedTurnIndex ? '#ff0000' : '#999999';
                    marker.time = Math.max(marker.time, segments[index].start);
                    // セグメント領域の視覚的な更新
                    const regionKeys = Object.keys(ws.regions.list);
                    const region = ws.regions.list[regionKeys[index]];
                    if (region) {
                        region.update({
                            start: Math.max(0, marker.time - 0.1),
                            end: Math.min(ws.getDuration(), marker.time + 0.1)
                        });
                        if (index === selectedTurnIndex) {
                            region.update({ color: 'rgba(255, 0, 0, 0.1)' });
                        }
                    }
                }
                // マーカーの変更を未保存状態にする
                setHasUnsavedMarkerChanges(true);
            }
        }
    };

    const handleMarkerDragEnd = useCallback(() => {
        if (!wavesurfer.current) return;
        const ws = wavesurfer.current;

        // 一時マーカーの位置を視覚的に更新するだけで、stateは更新しない
        const tempStartMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (開始)');
        const tempEndMarker = Object.values(ws.markers.markers || {}).find((m: any) => m.label === '一時マーカー (終了)');

        if (tempStartMarker && tempEndMarker) {
            setHasUnsavedMarkerChanges(true);
        }

        // 既存のマーカーの位置変更を検出
        const existingMarkers = Object.values(ws.markers.markers || {}).filter((marker: any) =>
            marker.label?.startsWith('発話開始') || marker.label?.startsWith('発話終了')
        );

        existingMarkers.forEach((marker: any) => {
            const matchStart = marker.label?.match(/発話開始 (\d+)/);
            const matchEnd = marker.label?.match(/発話終了 (\d+)/);
            if (matchStart || matchEnd) {
                const index = parseInt((matchStart?.[1] || matchEnd?.[1]) as string) - 1;
                if (index >= 0 && index < segments.length) {
                    if ((matchStart && Math.abs(segments[index].start - marker.time) > 0.001) ||
                        (matchEnd && Math.abs(segments[index].end - marker.time) > 0.001)) {
                        setHasUnsavedMarkerChanges(true);
                    }
                }
            }
        });
    }, [segments]);

    useEffect(() => {
        if (!waveformRef.current) return;

        if (wavesurfer.current) {
            wavesurfer.current.destroy();
        }

        const ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: '#4a90e2',
            progressColor: '#2196f3',
            cursorColor: '#2196f3',
            plugins: [
                MarkerPlugin.create({
                    draggable: true,
                    dragTooltip: true
                }),
                RegionsPlugin.create()
            ],
            height: 200,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            responsive: true,
            normalize: true,
            interact: true,
            minPxPerSec: 100,
            scrollParent: true,
            fillParent: true,
            pixelRatio: 1,
            autoCenter: true,
            partialRender: true,
            barHeight: 1.0,
            mediaControls: false,
            hideScrollbar: true,
            splitChannels: false,
            backend: 'WebAudio',
            cursorWidth: 1,
        });

        wavesurfer.current = ws;

        const handleReady = () => {
            setIsReady(true);
            setDuration(ws.getDuration());
            updateMarkersDisplay(ws, segments);

            // 初期状態では波形全体を表示
            const containerWidth = ws.container.clientWidth;
            const initialMinPxPerSec = containerWidth / ws.getDuration();
            ws.zoom(initialMinPxPerSec);
            setZoomLevel(1);
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => {
            if (!ws.isScrolling) {  // スクロール中は更新を抑制
                setCurrentTime(ws.getCurrentTime());
            }
        };

        const handleScroll = () => {
            ws.isScrolling = true;
            if (ws.scrollTimeout) {
                clearTimeout(ws.scrollTimeout);
            }
            ws.scrollTimeout = setTimeout(() => {
                ws.isScrolling = false;
            }, 100);
        };

        const handleMarkerDragStart = (marker: any) => {
            const matchStart = marker.label?.match(/発話開始 (\d+)/);
            const matchEnd = marker.label?.match(/発話終了 (\d+)/);
            const index = matchStart ? parseInt(matchStart[1]) - 1 : matchEnd ? parseInt(matchEnd[1]) - 1 : -1;
            if (index !== -1 && onMarkerSelect) {
                onMarkerSelect(index);
            }
        };

        // イベントリスナーを設定
        ws.on('marker-drag-start', handleMarkerDragStart);
        ws.on('marker-drag', handleMarkerDrag);
        ws.on('marker-drag-end', handleMarkerDragEnd);
        ws.on('marker-click', handleMarkerDragStart);
        ws.on('click', handleClick);
        ws.on('ready', handleReady);
        ws.on('play', handlePlay);
        ws.on('pause', handlePause);
        ws.on('audioprocess', handleTimeUpdate);
        ws.on('scroll', handleScroll);

        // オーディオファイルを読み込み
        ws.loadBlob(audioFile);

        return () => {
            if (ws.scrollTimeout) {
                clearTimeout(ws.scrollTimeout);
            }
            ws.destroy();
            setIsReady(false);
            setIsPlaying(false);
        };
    }, [audioFile, segments, updateMarkersDisplay, onMarkerSet, onMarkerSelect, isAnnotationMode]);

    const toggleAnnotationMode = useCallback(() => {
        setIsAnnotationMode(!isAnnotationMode);
        setTempMarkers({});
        setHasUnsavedMarkerChanges(false);
    }, [isAnnotationMode]);

    const handleZoom = useCallback((newZoom: number) => {
        if (!wavesurfer.current) return;
        const ws = wavesurfer.current;

        // 現在の再生状態と位置を保存
        const wasPlaying = ws.isPlaying();
        const currentProgress = ws.backend.getPlayedPercents();  // 現在の再生位置を割合で取得

        if (wasPlaying) {
            ws.pause();
        }

        // ズーム処理
        if (newZoom === 1.0) {
            const containerWidth = ws.container.clientWidth;
            const initialMinPxPerSec = containerWidth / ws.getDuration();

            // zoom()の代わりにパラメータを直接設定してから一括更新
            ws.params.minPxPerSec = initialMinPxPerSec;
            ws.drawer.progress(currentProgress);
            ws.drawBuffer();
        } else {
            // zoom()の代わりにパラメータを直接設定してから一括更新
            ws.params.minPxPerSec = newZoom * 100;
            ws.drawer.progress(currentProgress);
            ws.drawBuffer();
        }

        if (wasPlaying) {
            ws.play();
        }
    }, []);

    const handleZoomIn = useCallback(() => {
        const newZoom = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
        setZoomLevel(newZoom);
        handleZoom(newZoom);
    }, [zoomLevel, handleZoom]);

    const handleZoomOut = useCallback(() => {
        const newZoom = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
        setZoomLevel(newZoom);
        handleZoom(newZoom);
    }, [zoomLevel, handleZoom]);

    const handleResetZoom = useCallback(() => {
        if (!wavesurfer.current) return;
        const ws = wavesurfer.current;

        // 現在の再生状態と位置を保存
        const wasPlaying = ws.isPlaying();
        const currentProgress = ws.backend.getPlayedPercents();

        if (wasPlaying) {
            ws.pause();
        }

        // コンテナ幅に合わせて初期ズームレベルを計算
        const containerWidth = ws.container.clientWidth;
        const initialMinPxPerSec = containerWidth / ws.getDuration();

        // ズームをリセット
        ws.params.minPxPerSec = initialMinPxPerSec;
        ws.drawer.progress(currentProgress);
        ws.drawBuffer();
        setZoomLevel(1);

        if (wasPlaying) {
            ws.play();
        }
    }, []);

    return (
        <Box sx={{
            backgroundColor: '#f5f5f5',
            padding: 3,
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    mb: 3,
                    backgroundColor: isAnnotationMode ? '#e3f2fd' : 'inherit',
                    border: isAnnotationMode ? '1px solid #90caf9' : 'none'
                }}
            >
                <Stack direction="row" spacing={3} alignItems="center">
                    <Button
                        variant={isAnnotationMode ? "contained" : "outlined"}
                        onClick={toggleAnnotationMode}
                        startIcon={<Box sx={{ '& > svg': { fontSize: '1.8rem' } }}>{isAnnotationMode ? <StopIcon /> : <EditIcon />}</Box>}
                        color={isAnnotationMode ? "primary" : "inherit"}
                        sx={{
                            fontSize: '1.4rem',
                            py: 1.5,
                            px: 3
                        }}
                    >
                        {isAnnotationMode ? 'アノテーション終了' : 'アノテーション開始'}
                    </Button>
                    {isAnnotationMode && wavesurfer.current && (
                        <>
                            <Button
                                variant="outlined"
                                onClick={handleAddMarkerAtCurrentTime}
                                startIcon={<Box sx={{ '& > svg': { fontSize: '1.8rem' } }}><FlagIcon /></Box>}
                                color="primary"
                                disabled={Object.values(wavesurfer.current.markers.markers || {}).some(m => (m as any).label === '一時マーカー (終了)')}
                                sx={{
                                    fontSize: '1.4rem',
                                    py: 1.5,
                                    px: 3
                                }}
                            >
                                {Object.values(wavesurfer.current.markers.markers || {}).some(m => (m as any).label === '一時マーカー (開始)')
                                    ? '発話終了マーカーを追加'
                                    : '発話開始マーカーを追加'}
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleConfirmMarkerPositions}
                                disabled={!hasUnsavedMarkerChanges}
                                color="success"
                                sx={{
                                    fontSize: '1.4rem',
                                    py: 1.5,
                                    px: 3
                                }}
                            >
                                マーカー位置を確定
                            </Button>
                        </>
                    )}
                    <Typography variant="body1" color="textSecondary" sx={{ fontSize: '1.3rem' }}>
                        {isAnnotationMode && wavesurfer.current
                            ? !Object.values(wavesurfer.current.markers.markers || {}).some(m => (m as any).label === '一時マーカー (開始)')
                                ? '発話開始位置を指定してください'
                                : !Object.values(wavesurfer.current.markers.markers || {}).some(m => (m as any).label === '一時マーカー (終了)')
                                    ? '発話終了位置を指定してください'
                                    : 'マーカー位置を確定してください'
                            : 'アノテーションを開始するにはボタンをクリックしてください'}
                    </Typography>
                </Stack>
            </Paper>

            <Box sx={{ mb: 2, mt: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
                    <Button
                        variant="outlined"
                        onClick={handleResetZoom}
                        disabled={zoomLevel === 1}
                        sx={{
                            fontSize: '1.2rem',
                            py: 1,
                            px: 2
                        }}
                    >
                        リセット
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={handleZoomOut}
                        startIcon={<ZoomOutIcon />}
                        disabled={zoomLevel <= MIN_ZOOM}
                        sx={{
                            fontSize: '1.2rem',
                            py: 1,
                            px: 2
                        }}
                    >
                        縮小
                    </Button>
                    <Typography
                        variant="body1"
                        sx={{
                            fontSize: '1.3rem',
                            fontWeight: 'bold',
                            color: 'text.secondary',
                            minWidth: '80px',
                            textAlign: 'center',
                            bgcolor: 'background.paper',
                            py: 1,
                            px: 2,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                        }}
                    >
                        {zoomLevel.toFixed(1)}x
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={handleZoomIn}
                        startIcon={<ZoomInIcon />}
                        disabled={zoomLevel >= MAX_ZOOM}
                        sx={{
                            fontSize: '1.2rem',
                            py: 1,
                            px: 2
                        }}
                    >
                        拡大
                    </Button>
                </Stack>
            </Box>

            <Box
                ref={waveformRef}
                sx={{
                    mb: 3,
                    cursor: isAnnotationMode ? 'crosshair' : 'default',
                    '&:hover': {
                        backgroundColor: isAnnotationMode ? 'rgba(0, 0, 0, 0.02)' : 'inherit'
                    },
                    height: 200,
                    '& wave': {
                        overflow: 'auto !important'
                    },
                    '& wave > wave': {
                        overflow: 'hidden !important'
                    }
                }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Stack direction="row" spacing={3} alignItems="center">
                    <Button
                        variant="contained"
                        onClick={handlePlayPause}
                        disabled={!isReady}
                        startIcon={<Box sx={{ '& > svg': { fontSize: '1.8rem' } }}>{isPlaying ? <PauseIcon /> : <PlayArrowIcon />}</Box>}
                        sx={{
                            fontSize: '1.4rem',
                            py: 1.5,
                            px: 3
                        }}
                    >
                        {isPlaying ? '一時停止' : '再生'}
                    </Button>
                    <Typography variant="body1" sx={{ fontSize: '1.3rem' }}>
                        現在位置: {currentTime.toFixed(2)}秒
                    </Typography>
                </Stack>
                <Typography variant="body1" color="textSecondary" sx={{ fontSize: '1.3rem' }}>
                    総再生時間: {duration.toFixed(2)}秒
                </Typography>
            </Box>

            {segments.length > 0 && (
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontSize: '1.5rem', mb: 2 }}>
                        マーカー一覧: {segments.length}個
                    </Typography>
                    <Stack spacing={2}>
                        {segments.map((segment, index) => (
                            <Paper
                                key={index}
                                elevation={1}
                                sx={{
                                    p: 2.5,
                                    bgcolor: index === selectedTurnIndex ? 'rgba(25, 118, 210, 0.08)' : 'background.paper',
                                    '&:hover': {
                                        bgcolor: 'rgba(25, 118, 210, 0.12)'
                                    }
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={2}
                                    alignItems="center"
                                    onClick={() => onMarkerSelect?.(index)}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <Typography variant="body1" sx={{ flex: 1, fontSize: '1.3rem' }}>
                                        発話 {index + 1}:
                                        <Typography component="span" color="success.main" sx={{ ml: 2, fontSize: '1.3rem' }}>
                                            開始 {segment.start.toFixed(2)}秒
                                        </Typography>
                                        <Typography component="span" color="error.main" sx={{ ml: 2, fontSize: '1.3rem' }}>
                                            終了 {segment.end.toFixed(2)}秒
                                        </Typography>
                                        <Typography component="span" color="textSecondary" sx={{ ml: 2, fontSize: '1.2rem' }}>
                                            (セグメント: {Math.max(0, segment.end - 0.1).toFixed(2)}秒 ～ {Math.min(duration, segment.end + 0.1).toFixed(2)}秒)
                                        </Typography>
                                    </Typography>
                                    <Button
                                        size="large"
                                        color="error"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteMarker(index);
                                        }}
                                        sx={{ fontSize: '1.3rem' }}
                                    >
                                        削除
                                    </Button>
                                </Stack>
                            </Paper>
                        ))}
                    </Stack>
                </Box>
            )}

            <Snackbar
                open={showMarkerFeedback}
                autoHideDuration={2000}
                onClose={() => setShowMarkerFeedback(false)}
                message="マーカーを設定しました"
                sx={{
                    '& .MuiSnackbarContent-message': {
                        fontSize: '1.3rem'
                    }
                }}
            />
        </Box>
    );
};

export default WaveformComponent;