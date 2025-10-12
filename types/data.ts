import type {
  Account,
  Card,
  CardToDeck,
  CardToTag,
  Deck,
  DeckToTag,
  FeatureRequest,
  FeatureVote,
  Field,
  FieldPreference,
  GraphData,
  GraphLink,
  GraphNode,
  ReviewRecord,
  SharedCard,
  SharedDeck,
  SmartDeck,
  SmartDeckCondition,
  Style,
  Tag,
  Template,
  UpdateLog,
  User,
  UserCardPreference,
  UserPreferences,
  CommentTargetType,
  LearningStatus,
  FieldType,
  CardFace,
  FieldRole,
  TemplateType,
} from "@prisma/client";

export type SafeJsonPrimitive = string | number | boolean | null;
export type SafeJsonValue =
  | SafeJsonPrimitive
  | SafeJsonValue[]
  | { [key: string]: SafeJsonValue };

export type SafeAccount = Account;

export type SafeUser = Omit<
  User,
  "createdAt" | "emailVerified" | "hashedPassword"
> & {
  createdAt: string;
  emailVerified: string | null;
};

export type SafeSmartDeckCondition = Omit<
  SmartDeckCondition,
  "conditionValue"
> & {
  conditionValue: SafeJsonValue;
};

export type SafeSmartDeck = SmartDeck & {
  conditions?: SafeSmartDeckCondition[];
};

export type SafeDeck = Omit<
  Deck,
  "createdAt" | "deletedAt" | "lastAccessedAt" | "lastModifiedAt"
> & {
  createdAt: string;
  deletedAt: string | null;
  lastAccessedAt: string | null;
  lastModifiedAt: string;
  cardCount?: number;
};

export type SafeDeckTree = SafeDeck & {
  children?: SafeDeckTree[];
};

export type SafeCard = Omit<
  Card,
  | "createdAt"
  | "deletedAt"
  | "lastAccessedAt"
  | "lastModifiedAt"
  | "fieldValues"
> & {
  createdAt: string;
  deletedAt: string | null;
  lastAccessedAt: string | null;
  lastModifiedAt: string;
  fieldValues: SafeJsonValue[];
  nextReviewDate?: string | null;
  deckNames?: string[];
  primaryDeckId?: string | null;
};

export type SafeCardToDeck = Omit<CardToDeck, "lastModifiedAt"> & {
  lastModifiedAt: string;
};

export type SafeSharedCard = Omit<SharedCard, "sharedAt"> & {
  sharedAt: string;
};

export type SafeSharedDeck = Omit<SharedDeck, "sharedAt"> & {
  sharedAt: string;
};

export type SafeTemplate = Omit<
  Template,
  "createdAt" | "lastModifiedAt" | "settings"
> & {
  createdAt: string;
  lastModifiedAt: string;
  settings: SafeJsonValue | null;
  style?: SafeStyle;
};

export type SafeField = Omit<Field, "lastModifiedAt"> & {
  lastModifiedAt: string;
};

export type SafeFieldPreference = Omit<
  FieldPreference,
  "lastModifiedAt" | "styleJson"
> & {
  lastModifiedAt: string;
  styleJson: SafeJsonValue | null;
};

export type SafeStyle = Omit<
  Style,
  "createdAt" | "lastModifiedAt" | "stylesJson"
> & {
  createdAt: string;
  lastModifiedAt: string;
  stylesJson: SafeJsonValue;
};

export type SafeTag = Omit<Tag, "createdAt" | "lastModifiedAt"> & {
  createdAt: string;
  lastModifiedAt: string;
};

export type SafeCardToTag = Omit<CardToTag, "lastModifiedAt"> & {
  lastModifiedAt: string;
};

export type SafeDeckToTag = Omit<DeckToTag, "lastModifiedAt"> & {
  lastModifiedAt: string;
};

export type SafeUserCardPreference = UserCardPreference;

export type SafeReviewRecord = Omit<ReviewRecord, "updatedAt"> & {
  updatedAt: string;
};

export type SafeCardInteraction = {
  id: string;
  role: string;
  content: string;
  updatedAt: string;
  progressId: string;
  userId: string;
  deletedAt: string | null;
};

export type SafeComment = {
  id: string;
  content: string;
  updatedAt: string;
  parentId: string | null;
  targetType: CommentTargetType;
  targetId: string;
  progressId: string;
  deletedAt: string | null;
  userId: string;
  replyIds?: string[];
};

export type SafeUserCardProgress = {
  id: string;
  userId: string;
  cardId: string;
  deckId: string;
  lastModifiedAt: string;
  nextReviewDate: string | null;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  learningStatus: LearningStatus;
  totalStudyTime: number;
  reviewRecords: SafeReviewRecord[];
  cardInteractions?: SafeCardInteraction[];
  comments?: SafeComment[];
};

export type SafeModelUpdates = Record<string, SafeJsonValue>;

export type SafeUpdateLog = Omit<UpdateLog, "lastUpdated" | "modelUpdates"> & {
  lastUpdated: string;
  modelUpdates: SafeModelUpdates;
};

export type SafeGraphNode = Omit<GraphNode, "data"> & {
  data: SafeJsonValue;
};

export type SafeGraphData = Omit<
  GraphData,
  "createdAt" | "lastModifiedAt" | "nodes"
> & {
  createdAt: string;
  lastModifiedAt: string;
  nodes: SafeGraphNode[];
  links: GraphLink[];
};

export type SafeFeatureRequest = Omit<
  FeatureRequest,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type SafeFeatureVote = Omit<FeatureVote, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type SafeUserPreferences = Omit<
  UserPreferences,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type SafeAccountBundle = {
  user: SafeUser;
  accounts: SafeAccount[];
  preferences?: SafeUserPreferences;
};

export type OutputCard = {
  id: string;
  templateId: string;
  createdById: string;
  ownedById: string;
  fieldValues: SafeJsonValue[];
  userCardProgress: SafeUserCardProgress;
};

export type OutputField = {
  id?: string;
  name: string;
  type: FieldType;
  fieldPreferences: SafeFieldPreference[];
};

export type OutputStyle = {
  id: string;
  stylesJson: SafeJsonValue;
};

export type OutputTemplate = {
  id: string;
  type: TemplateType;
  fields: OutputField[];
  styles: OutputStyle;
};

export type OutputDeckData = {
  cards: OutputCard[];
  templates: OutputTemplate[];
};

export interface CardStyleState {
  background: string;
  borderRadius: string;
  border: string;
  fontFamily: string;
  flexDirection: "row" | "column";
  justifyContent: string;
  alignItems: string;
  [key: string]: string | "row" | "column";
}

export interface FieldPreferenceItem {
  id: string;
  fieldId: string;
  type: FieldType;
  cardFace: CardFace | null;
  role?: FieldRole | null;
  position?: number | null;
}
