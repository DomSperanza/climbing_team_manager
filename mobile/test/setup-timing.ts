// Tests run against an in-memory Sheet, where no other coach's write can still be landing.
import { saveTiming } from "../src/core/writes";

saveTiming.settleMs = 0;
