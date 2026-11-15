export function isCachedIdentityKey(key: string) {
  return key.startsWith('activeBusiness:') || /^sb-.+-auth/.test(key);
}

export function clearCachedIdentity(storage: Storage) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isCachedIdentityKey(key)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}
