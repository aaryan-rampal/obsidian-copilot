/**
 * Returns true when the provided value is a plain object.
 *
 * @param {unknown} value Value to validate.
 * @returns {boolean} Whether the value is a plain object.
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge deploy override data into the current plugin settings.
 *
 * Only keys present in the override object are replaced.
 *
 * @param {Record<string, unknown>} existingData Current plugin settings.
 * @param {Record<string, unknown>} overrideData Deploy override fragment.
 * @returns {Record<string, unknown>} Merged settings object.
 */
function mergeDeployData(existingData, overrideData) {
  const safeExistingData = isPlainObject(existingData) ? existingData : {};
  const safeOverrideData = isPlainObject(overrideData) ? overrideData : {};

  return {
    ...safeExistingData,
    ...safeOverrideData,
  };
}

module.exports = {
  isPlainObject,
  mergeDeployData,
};
