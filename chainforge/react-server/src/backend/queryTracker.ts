export default class QueryTracker {
    private static instance: QueryTracker;
    private data: Set<string>;
  
    private constructor() {
      this.data = new Set();
    }
  
    public static getInstance(): QueryTracker {
      if (!QueryTracker.instance) {
        QueryTracker.instance = new QueryTracker();
      }
      return QueryTracker.instance;
    }

    private addId(id: string): void {
        this.data.add(id);
    }

    public static add(id: string): void {
        QueryTracker.getInstance().addId(id);
    }

    private hasId(id: string): boolean {
        return this.data.has(id);
    }

    public static has(id: string): boolean {
        return QueryTracker.getInstance().hasId(id);
    }

    private deleteId(id: string): void {
        if (QueryTracker.has(id)) {
            this.data.delete(id);
        } else {
            return;
        }
        
    }

    public static delete(id: string): void {
        QueryTracker.getInstance().deleteId(id);
    }

    private clearTracker(): void {
        this.data.clear();
    }

    public static clear(): void {
        QueryTracker.getInstance().clearTracker();
    }
  
  }
  