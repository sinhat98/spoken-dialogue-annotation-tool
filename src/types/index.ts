export interface ConversationData {
    customerId: string;
    conversationId: string;
    audioFileHandle: FileSystemFileHandle;
    conversationLogHandle: FileSystemFileHandle;
}

export interface ConversationLog {
    customerId: string;
    conversationId: string;
    text: string;
}

export interface Segment {
    start: number;
    end: number;
}

export interface SlotValue {
    key: string;
    value: string;
}

export interface Turn {
    intent: string;
    slots: SlotValue[];
    segments: Segment[];
}

export interface DialogueAnnotation {
    customerId: string;
    conversationId: string;
    turns: {
        segments: Segment[];
        intent: string;
        slots: SlotValue[];
    }[];
    dialogueSlots: SlotValue[];
    intent?: string;
}

export interface AnnotationProgress {
    total: number;
    completed: number;
} 