import { setGlobalOptions } from 'firebase-functions/v2';
import { FUNCTIONS_REGION } from '@inkwell/shared';

// onCall()/onRequest() read the global options when they are defined, so this module must be imported
// before any module that defines a function (it is the first import in index.ts).
setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 10 });
