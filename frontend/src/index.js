import Events from './events/Events.js';
import { UserService } from './services/UserService.js';
import { UserView } from './views/UserView.js';
import { TrainingView } from './views/TrainingView.js';
import { RecommendationView } from './views/RecommendationView.js';
import { UserController } from './controllers/UserController.js';
import { ModelController } from './controllers/ModelController.js';
import { WorkerController } from './controllers/WorkerController.js';

// Servicos e views compartilhados.
const userService = new UserService();
const userView = new UserView();
const trainingView = new TrainingView();
const recommendationView = new RecommendationView();

// Worker de ML (thread separada) ligado ao barramento de eventos.
const worker = new Worker('/src/workers/recommendationWorker.js', { type: 'module' });
WorkerController.init({ worker, events: Events });

// Controllers.
UserController.init({ userView, userService, events: Events });
ModelController.init({ trainingView, recommendationView, userService, events: Events });
