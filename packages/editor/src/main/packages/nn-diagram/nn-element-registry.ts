/**
 * Lightweight singleton registry that tracks NNContainer and Configuration element IDs.
 * Used by NNNext to prevent "next" connections involving NNContainer or Configuration.
 * Capped at 100 entries per type to prevent unbounded memory growth.
 */
class NNElementRegistryClass {
  private containerIds = new Set<string>();
  private configurationIds = new Set<string>();
  private static MAX_SIZE = 100;

  registerContainer(id: string) {
    // Evict oldest entries if we exceed the cap
    if (this.containerIds.size >= NNElementRegistryClass.MAX_SIZE) {
      const first = this.containerIds.values().next().value;
      if (first) this.containerIds.delete(first);
    }
    this.containerIds.add(id);
  }

  registerConfiguration(id: string) {
    // Evict oldest entries if we exceed the cap
    if (this.configurationIds.size >= NNElementRegistryClass.MAX_SIZE) {
      const first = this.configurationIds.values().next().value;
      if (first) this.configurationIds.delete(first);
    }
    this.configurationIds.add(id);
  }

  isNNContainer(id?: string): boolean {
    return id ? this.containerIds.has(id) : false;
  }

  isConfiguration(id?: string): boolean {
    return id ? this.configurationIds.has(id) : false;
  }
}

export const NNElementRegistry = new NNElementRegistryClass();
