'use strict';

/**
 * complain service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::complain.complain');
