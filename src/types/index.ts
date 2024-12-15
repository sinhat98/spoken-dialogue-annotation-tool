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
    segments: Segment[];
    intent: string;
    slots: SlotValue[];
}

export interface DialogueAnnotation {
    customerId: string;
    conversationId: string;
    turns: Turn[];
    dialogueSlots: SlotValue[];
}

export interface AnnotationProgress {
    total: number;
    completed: number;
} 