import { Injectable } from '@nestjs/common';

type LeaseHeartbeatInput = {
  intervalMs: number;
  renew: () => Promise<boolean>;
};

export type LeaseHeartbeatHandle = {
  hasLease(): boolean;
  stop(): Promise<void>;
};

@Injectable()
export class LeaseHeartbeatRunner {
  start(input: LeaseHeartbeatInput): LeaseHeartbeatHandle {
    let active = true;
    let leaseValid = true;
    let timer: NodeJS.Timeout | null = null;
    let inFlightRenewal: Promise<void> | null = null;

    const tick = async () => {
      if (!active || !leaseValid) {
        return;
      }

      try {
        const renewed = await input.renew();
        if (renewed) {
          return;
        }
      } catch {
        // Treat renewal errors as lease loss so workers stop instead of
        // continuing on a stale ownership assumption.
      }

      if (leaseValid) {
        leaseValid = false;
        clear();
      }
    };

    const schedule = () => {
      timer = setInterval(() => {
        if (inFlightRenewal) {
          return;
        }

        inFlightRenewal = tick().finally(() => {
          inFlightRenewal = null;
        });
      }, input.intervalMs);
    };

    const clear = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    schedule();

    return {
      hasLease: () => leaseValid,
      stop: async () => {
        active = false;
        clear();
        await inFlightRenewal;
      }
    };
  }
}
