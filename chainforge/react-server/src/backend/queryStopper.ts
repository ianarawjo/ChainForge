export default class QueryStopper {
    private static instance: QueryStopper;
    private data: Set<string>;
  
    private constructor() {
      this.data = new Set();
    }
  
    public static getInstance(): QueryStopper {
      if (!QueryStopper.instance) {
        QueryStopper.instance = new QueryStopper();
      }
      return QueryStopper.instance;
    }

    private addId(id: string): void {
        this.data.add(id);
    }

    public static add(id: string): void {
        QueryStopper.getInstance().addId(id);
    }

    private hasId(id: string): boolean {
        return this.data.has(id);
    }

    public static has(id: string): boolean {
        return QueryStopper.getInstance().hasId(id);
    }

    private clearId(id: string): void {
        if (QueryStopper.has(id)) {
            this.data.delete(id);
        } else {
            return;
        }
        
    }

    public static clear(id: string): void {
        QueryStopper.getInstance().clearId(id);
    }

    private clearTracker(): void {
        this.data.clear();
    }

    public static clearAll(): void {
        QueryStopper.getInstance().clearTracker();
    }
  
  }
  