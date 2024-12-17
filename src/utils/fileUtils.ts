import { ConversationData, ConversationLog, DialogueAnnotation } from '../types';
import Papa from 'papaparse';

export const scanDirectory = async (directoryHandle: FileSystemDirectoryHandle): Promise<ConversationData[]> => {
    const conversations: ConversationData[] = [];

    for await (const customerHandle of directoryHandle.values()) {
        if (customerHandle.kind === 'directory') {
            const customerId = customerHandle.name;

            for await (const conversationHandle of (customerHandle as FileSystemDirectoryHandle).values()) {
                if (conversationHandle.kind === 'directory') {
                    const conversationId = conversationHandle.name;
                    let audioFileHandle: FileSystemFileHandle | null = null;
                    let conversationLogHandle: FileSystemFileHandle | null = null;

                    for await (const fileHandle of (conversationHandle as FileSystemDirectoryHandle).values()) {
                        if (fileHandle.kind === 'file') {
                            if (fileHandle.name === 'audio_processed.wav') {
                                audioFileHandle = fileHandle as FileSystemFileHandle;
                            } else if (fileHandle.name === 'conversation.csv') {
                                conversationLogHandle = fileHandle as FileSystemFileHandle;
                            }
                        }
                    }

                    if (audioFileHandle && conversationLogHandle) {
                        conversations.push({
                            customerId,
                            conversationId,
                            audioFileHandle,
                            conversationLogHandle
                        });
                    }
                }
            }
        }
    }

    return conversations;
};

export const loadAudioFile = async (fileHandle: FileSystemFileHandle): Promise<File> => {
    const file = await fileHandle.getFile();
    return new File([file], file.name, { type: file.type });
};

export const loadConversationLogFile = async (fileHandle: FileSystemFileHandle): Promise<File> => {
    const file = await fileHandle.getFile();
    return new File([file], file.name, { type: 'text/csv' });
};

export const readConversationLog = async (file: File): Promise<ConversationLog[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                resolve(results.data as ConversationLog[]);
            },
            error: (error) => {
                reject(error);
            }
        });
    });
};

export const readTextFile = async (file: File): Promise<string[]> => {
    const text = await file.text();
    return text.split('\n').map(line => line.trim()).filter(line => line);
};

export const exportAnnotations = (annotations: DialogueAnnotation[]): string => {
    // ヘッダー行の定義
    const headers = [
        'customerId',
        'conversationId',
        'turnIndex',
        'utteranceStart',
        'utteranceEnd',
        'segmentStart',
        'segmentEnd',
        'intent',
        'turnSlots',
        'dialogueSlots'
    ];

    // CSVヘッダー行の作成
    let csv = headers.join(',') + '\n';

    // 各アノテーションデータの処理
    annotations.forEach(annotation => {
        // 各ターンについて1レコードを作成
        annotation.turns.forEach((turn, turnIndex) => {
            const row = [
                `<span style="font-size: 16px">${annotation.customerId}</span>`,
                `<span style="font-size: 16px">${annotation.conversationId}</span>`,
                turnIndex,
                turn.segments[0].start,
                turn.segments[0].end,
                Math.max(0, turn.segments[0].end - 0.1),  // セグメント開始時刻
                Math.min(turn.segments[0].end + 0.1),     // セグメント終了時刻
                turn.intent,
                JSON.stringify(turn.slots),
                JSON.stringify(annotation.dialogueSlots)
            ];

            // 値のエスケープ処理
            const escapedRow = row.map(value => {
                if (typeof value === 'string') {
                    // カンマやダブルクォートを含む場合、ダブルクォートで囲む
                    if (value.includes(',') || value.includes('"')) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                }
                return value;
            });

            csv += escapedRow.join(',') + '\n';
        });
    });

    return csv;
};

export interface AnnotationData extends DialogueAnnotation {
    customerId: string;
    conversationId: string;
    turns: Array<{
        segments: Array<{ start: number; end: number }>;
        intent: string;
        slots: Array<{ key: string; value: string }>;
    }>;
    dialogueSlots: Array<{ key: string; value: string }>;
}

export const saveAnnotation = async (
    customerId: string,
    conversationId: string,
    annotationData: DialogueAnnotation,
    directoryHandle: FileSystemDirectoryHandle
): Promise<void> => {
    try {
        // .cacheディレクトリを取得または作成
        let cacheHandle: FileSystemDirectoryHandle;
        try {
            cacheHandle = await directoryHandle.getDirectoryHandle('.cache');
        } catch {
            cacheHandle = await directoryHandle.getDirectoryHandle('.cache', { create: true });
        }

        // アノテーションファイルを作成または取得
        const filename = `${customerId}_${conversationId}.json`;
        const fileHandle = await cacheHandle.getFileHandle(filename, { create: true });

        // ファイルに書き込み
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(annotationData, null, 2));
        await writable.close();

    } catch (error) {
        console.error('Failed to save annotation:', error);
        throw error;
    }
};

export const loadAnnotation = async (
    customerId: string,
    conversationId: string,
    directoryHandle: FileSystemDirectoryHandle
): Promise<DialogueAnnotation | null> => {
    try {
        // .cacheディレクトリを取得
        const cacheHandle = await directoryHandle.getDirectoryHandle('.cache');
        const filename = `${customerId}_${conversationId}.json`;

        try {
            const fileHandle = await cacheHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            const data = await file.text();
            const parsed = JSON.parse(data);
            return {
                customerId,
                conversationId,
                turns: parsed.turns || [],
                dialogueSlots: parsed.dialogueSlots || []
            };
        } catch {
            return null;
        }
    } catch (error) {
        console.error('Failed to load annotation:', error);
        return null;
    }
};

export const clearCache = async (directoryHandle: FileSystemDirectoryHandle) => {
    try {
        // .cacheディレクトリを取得
        const cacheHandle = await directoryHandle.getDirectoryHandle('.cache', { create: false });

        // .cacheディレクトリ内のすべてのファイルを削除
        for await (const [name, handle] of cacheHandle.entries()) {
            await cacheHandle.removeEntry(name);
        }

        // .cacheディレクトリ自体を削除
        await directoryHandle.removeEntry('.cache');

        return true;
    } catch (error) {
        console.error('Failed to clear cache:', error);
        return false;
    }
}; 