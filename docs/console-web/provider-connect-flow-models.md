responsibility
- own provider connect dialog, connect session, and authentication form behavior inside `provider`
- keep dialog and form components limited to mutation orchestration and rendering

key methods
- `providerConnectDialogModel(connectOptions, preferredOptionKind)`
- `providerConnectSessionModel(session)`
- `providerAuthenticationModel(input)`
- `providerRequestErrorMessage(error, fallback)`

implementation notes
- connect dialog model owns option scoping, preferred option selection, dialog copy, and probe input derivation
- connect session model owns phase message, action visibility, callback eligibility, and session-scoped fields
- authentication model owns account-id preconditions, oauth intro copy, api key placeholder, and action labels
- mutation boundaries normalize request errors through one shared mapper
