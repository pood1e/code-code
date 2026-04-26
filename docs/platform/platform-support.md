# Platform Support

## responsibility

`platform-support-service` owns static vendor and CLI support data plus CLI runtime image/version support.

## external fields

- `SupportService.ListVendors`, `SupportService.GetVendor`
- `SupportService.ListCLIs`, `SupportService.GetCLI`
- `CLIRuntimeService.ListCLIRuntimeRecords`
- `CLIRuntimeService.GetLatestAvailableCLIRuntimeImages`

## implementation notes

- Vendor and CLI support data are queried directly as `Vendor` and `CLI`.
- Provider runtime state stays in `platform-provider-service`.
- CLI version sync and runtime image build stay in the same service because they depend on CLI support data.
