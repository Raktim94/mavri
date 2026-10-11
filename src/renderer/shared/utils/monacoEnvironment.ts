import EditorWorker from './workers/editor.worker?worker';
import JsonWorker from './workers/json.worker?worker';

const JSON_LABEL = 'json';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === JSON_LABEL) {
      return new JsonWorker();
    }
    return new EditorWorker();
  }
};
