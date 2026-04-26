responsibility
- register model source collection strategies inside `models`
- expose generic source metadata lookup for collection, preset-source detection, and authority priority

key fields or methods
- `registerDefinitionSourceCollector(spec)`
- `registeredDefinitionSourceCollectors()`
- `lookupDefinitionSourceCollector(sourceID)`
- `DefinitionSyncReconciler.sourceEndpoints`

implementation notes
- each concrete source registers its own collector, collection order, authority priority, and preset-source flag
- generic collection flow iterates registered collectors and never switches on concrete source ids
