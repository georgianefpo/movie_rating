// Controla o seletor/perfil de usuario.
export class UserController {
    #userView;
    #userService;
    #events;

    constructor({ userView, userService, events }) {
        this.#userView = userView;
        this.#userService = userService;
        this.#events = events;
    }

    static init(deps) {
        const c = new UserController(deps);
        c.#start();
        return c;
    }

    async #start() {
        const users = await this.#userService.listUsers(60);
        this.#userView.renderUserOptions(users);

        this.#userView.onUserSelected(async (id) => {
            const user = await this.#userService.getUser(id);
            this.#userView.renderProfile(user);
            this.#events.dispatchUserSelected(user);
        });
    }
}
