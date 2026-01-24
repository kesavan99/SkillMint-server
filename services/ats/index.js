/**
 * ATS Service Index - Export all ATS modules
 */

const ATSScorer = require('./atsScorer');
const SkillMatcher = require('./skillMatcher');
const TextProcessor = require('./textProcessor');
const { ATSWeights, HardFilterThresholds, DEGREE_LEVELS } = require('./atsConfig');

module.exports = {
  ATSScorer,
  SkillMatcher,
  TextProcessor,
  ATSWeights,
  HardFilterThresholds,
  DEGREE_LEVELS
};
