This guide details the complete setup and core architectural configuration for our Next.js application, integrating the full technology stack and adhering to the **"Content-Format-Style Separation"** principle.

## 1\. Core Technology Stack (Installed)

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | **Next.js** (App Router) | Full-stack React with server components. |
| **Styling** | **Tailwind CSS**, **shadcn/ui** | Utility-first CSS and component library. |
| **Auth & DB** | **next-auth**, **Prisma**, **MongoDB** | Authentication, ORM, and cloud data persistence. |
| **Local Data** | **Dexie** (IndexedDB) | Client-side data storage for high performance and offline support. |
| **State** | **Redux Toolkit** (RTK) | Complex global state management and async logic. |
| **UX/UI** | **lucide-react**, **framer-motion** | Icons and advanced UI animations. |
| **Internationalization** | **next-intl** | Multi-language support (`en`, `zh`). |
| **Cloud** | **@aws-sdk/client-s3** | Secure media (images/audio) storage. |
| **Visualization** | **echarts** | Data statistics and progress visualization. |

-----

## 2\. Core Data Transformation & Safety Types

Since you prefer to serialize **`Date` objects to `string`** for frontend safety, we must define **Safe Types** for all models that will be passed from the API layer (Prisma/Server) to the Client (Redux/Components).

### A. Date Serialization Utility

Create a utility function to simplify serialization on the server:

```typescript
// lib/utils/serialization.ts

/** Converts all Date fields in an object to ISO strings. */
export const dateToStrings = <T extends Record<string, any>>(obj: T): T => {
  if (!obj) return obj;
  const newObj = { ...obj };
  for (const key in newObj) {
    if (newObj[key] instanceof Date) {
      newObj[key] = newObj[key].toISOString();
    } else if (newObj[key] === null) {
      // Keep null values
      newObj[key] = null;
    }
  }
  return newObj;
};
```

### B. Safe Frontend Types (Example: `SafeDeck`, `SafeCard`)

Define safe types based on your Prisma schema. These types should live in a shared file (e.g., `types/data.ts`).

```typescript
// types/data.ts

import { Deck, Card, UserCardProgress } from '@prisma/client';

// 1. SafeDeck
export type SafeDeck = Omit<
  Deck,
  "createdAt" | "deletedAt" | "lastAccessedAt" | "lastModifiedAt" | "parentId"
> & {
  createdAt: string;
  deletedAt: string | null;
  lastAccessedAt: string | null;
  lastModifiedAt: string;
  parentId: string | null;
  cardCount?: number;
  children?: SafeDeck[]; 
};

// 2. SafeCard
export type SafeCard = Omit<
  Card,
  "createdAt" | "deletedAt" | "lastAccessedAt" | "lastModifiedAt" | "fieldValues"
> & {
  createdAt: string;
  deletedAt: string | null;
  lastAccessedAt: string | null;
  lastModifiedAt: string;
  // fieldValues: JSON in Prisma, use Array<any> for frontend
  fieldValues: Array<any>; 
};

// 3. SafeUserCardProgress
export type SafeUserCardProgress = Omit<
  UserCardProgress,
  "lastModifiedAt" | "nextReviewDate"
> & {
  lastModifiedAt: string;
  nextReviewDate: string | null;
  // reviewRecords is a Type, keep as Array<any> or define a SafeReviewRecord
  reviewRecords: Array<any>; 
};
```

-----

## 3\. Core Architectural Configuration

### A. Data Layer Setup

| File | Content Focus | Key Requirement |
| :--- | :--- | :--- |
| **`lib/prisma.ts`** | Centralized `PrismaClient` singleton setup. | **Must** prevent multiple instantiations in development (hot reload issue). |
| **`lib/db-dexie.ts`** | Initialize `Dexie` instance and schema. | **Must** define **`cards`** and **`progresses`** tables with `cardId`/`progressId` indexed for cloud sync reference. |
| **`lib/auth.ts`** | `next-auth` configuration. | **Must** use the **Prisma Adapter** and implement **JWT callbacks** to inject `user.id` into the session for API access control. |

### B. Redux Toolkit Configuration (`RTK`)

1.  **Store Configuration (`redux/store.ts`)**:

      * Setup `configureStore`.
      * **Crucially**, add middleware to **disable serializable check** for actions involving `Dexie` objects, as they contain non-serializable IndexedDB references.
      * Initial slices: `userSlice` (Auth state, preferences), `deckSlice` (SafeDeck data), `studySlice` (SafeCard/SafeProgress data).

2.  **Dexie Sync Thunk (`redux/slices/studySlice.ts`)**:

      * Create `createAsyncThunk` (e.g., `syncData`).
      * This Thunk is responsible for the **bidirectional sync** between **Prisma (Cloud)** and **Dexie (Local)**, ensuring local data consistency for offline work.

-----

### C. Frontend Service Integration

1.  **Global Providers (`app/layout.tsx`)**:

      * Wrap the app with `NextIntlClientProvider`, `ReduxProvider`, and `SessionProvider`. **Order matters**—`SessionProvider` and `ReduxProvider` should typically wrap the component tree to provide context first.

2.  **Card Rendering Engine (`components/card-renderer/CardRenderer.tsx`)**:

      * **Input**: `SafeCard` data, `Style.stylesJson` (CSS string), and `Template` mapping logic.
      * **Function**: Dynamically inject the **CSS string** into a `<style>` tag within the component (using `dangerouslySetInnerHTML`) to apply styles locally, maintaining Anki's content separation.
      * **Content**: Use the template logic to substitute `fieldValues` into the final card HTML.

3.  **Image Upload Service (`app/api/s3-upload/route.ts`)**:

      * Implement the API route to securely generate a **Pre-Signed S3 Upload URL** using `@aws-sdk/client-s3` and `getSignedUrl`.
      * Ensure all **AWS credentials** are stored in the server environment (`.env`) and **never exposed to the client**.

4.  **UI/UX**:

      * Initialize `shadcn/ui` components.
      * Use **`framer-motion`** to implement smooth transitions and subtle animations for the card review flow, enhancing the "复习体验良好" goal.

## 4\. MVP Implementation Focus

The initial development should strictly adhere to the MVP list, leveraging the installed tools:

1.  **Quick Card Creation**: Implement the **"从粘贴板快速生成卡组"** feature using a modal/dialog (`shadcn/ui`) and Redux Thunks to post data to the server API.
2.  **Basic Review Flow**: Implement the **`study` tab** where cards are fetched from **Dexie**, rendered by **`CardRenderer`**, and user input (4-level rating) triggers an update in **Dexie** and an asynchronous sync back to Prisma.
3.  **Basic Stats**: Use **`echarts`** in the `stats` tab to display `复习数量` and `复习时间` (using data fetched from the `SafeUserCardProgress` models).