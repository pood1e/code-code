responsibility
- own provider connect form behavior inside a dedicated model
- own the minimum provider-domain composition rules for direct Radix Themes reuse

key methods or components
- `providerConnectFormModel(selectedOption)`
- `defaultProviderConnectFormValues(preferredOption)`

implementation notes
- connect form model owns guidance copy, submit label, protocol options, and field visibility
- page and dialog components compose Radix primitives directly and keep mutation logic local
- only stateful or rule-heavy UI stays as a dedicated component or model
