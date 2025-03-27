'use client';
'use strict';

var isOptionsGroup = require('./is-options-group.cjs');

function defaultOptionsFilter({
  options,
  search,
  limit
}) {
  const parsedSearch = search.trim().toLowerCase();
  const result = [];
  for (let i = 0; i < options.length; i += 1) {
    const item = options[i];
    if (result.length === limit) {
      return result;
    }
    if (isOptionsGroup.isOptionsGroup(item)) {
      result.push({
        group: item.group,
        items: defaultOptionsFilter({
          options: item.items,
          search,
          limit: limit - result.length
        })
      });
    }
    if (!isOptionsGroup.isOptionsGroup(item)) {
      if (item.label.toLowerCase().includes(parsedSearch)) {
        result.push(item);
      }
    }
  }
  return result;
}

exports.defaultOptionsFilter = defaultOptionsFilter;
//# sourceMappingURL=default-options-filter.cjs.map
