const userToGame = new Map<string, string>();
const gameToUsers = new Map<string, string[]>();

function uniqueUsers(userIDs: string[]): string[] {
    return Array.from(new Set(userIDs));
}

export function isUserInActiveGame(userID: string): boolean {
    return userToGame.has(userID);
}

export function tryActivateGame(gameID: string, userIDs: string[]): boolean {
    const users = uniqueUsers(userIDs);

    if (users.some(userID => userToGame.has(userID))) {
        return false;
    }

    for (const userID of users) {
        userToGame.set(userID, gameID);
    }

    gameToUsers.set(gameID, users);
    return true;
}

export function tryAddUsersToActiveGame(gameID: string, userIDs: string[]): boolean {
    const users = uniqueUsers(userIDs);
    const existingUsers = gameToUsers.get(gameID) ?? [];

    for (const userID of users) {
        const existingGameID = userToGame.get(userID);
        if (existingGameID && existingGameID !== gameID) {
            return false;
        }
    }

    const merged = uniqueUsers([...existingUsers, ...users]);
    gameToUsers.set(gameID, merged);
    for (const userID of users) {
        userToGame.set(userID, gameID);
    }

    return true;
}

export function removeUsersFromActiveGame(gameID: string, userIDs: string[]): void {
    const users = uniqueUsers(userIDs);
    const existingUsers = gameToUsers.get(gameID);
    if (!existingUsers) return;

    const remainingUsers = existingUsers.filter(userID => !users.includes(userID));
    for (const userID of users) {
        if (userToGame.get(userID) === gameID) {
            userToGame.delete(userID);
        }
    }

    if (remainingUsers.length === 0) {
        gameToUsers.delete(gameID);
        return;
    }

    gameToUsers.set(gameID, remainingUsers);
}

export function clearActiveGame(gameID: string): void {
    const users = gameToUsers.get(gameID);
    if (!users) return;

    for (const userID of users) {
        if (userToGame.get(userID) === gameID) {
            userToGame.delete(userID);
        }
    }

    gameToUsers.delete(gameID);
}
