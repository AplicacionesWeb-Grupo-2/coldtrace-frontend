<script setup>
import {computed, watch} from 'vue';
import {useI18n} from 'vue-i18n';

const {t} = useI18n();
/**
 * @typedef {Object} ListPaginationProps
 * @property {*} [modelValue]
 * @property {*} [total]
 * @property {*} [pageSize]
 */
const props = defineProps({
    modelValue: {
        type: Number,
        default: 1,
    },
    total: {
        type: Number,
        required: true,
    },
    pageSize: {
        type: Number,
        default: 10,
    },
});
/**
 * Component events emitted to parent components.
 *
 * @type {Function}
 */
const emit = defineEmits(['update:modelValue']);

const pageCount = computed(() => Math.max(Math.ceil(props.total / props.pageSize), 1));
const currentPage = computed(() => Math.min(Math.max(props.modelValue, 1), pageCount.value));
const pageStart = computed(() => props.total ? (currentPage.value - 1) * props.pageSize + 1 : 0);
const pageEnd = computed(() => Math.min(currentPage.value * props.pageSize, props.total));
const visiblePages = computed(() => {
    const totalPages = pageCount.value;
    const activePage = currentPage.value;

    if (totalPages <= 7) {
        return Array.from({length: totalPages}, (_, index) => index + 1);
    }

    if (activePage <= 4) {
        return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages];
    }

    if (activePage >= totalPages - 3) {
        return [1, 'start-ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'start-ellipsis', activePage - 1, activePage, activePage + 1, 'end-ellipsis', totalPages];
});

watch(pageCount, () => {
    if (props.modelValue !== currentPage.value) emit('update:modelValue', currentPage.value);
});

/**
 * Handles go to page behavior in the shared context.
 *
 * @param {number|string} page
 * @returns {*}
 */
function goToPage(page) {
    emit('update:modelValue', Math.min(Math.max(Number(page), 1), pageCount.value));
}
</script>

<template>
  <footer v-if="total > 0" class="table-pagination">
    <div class="footer-meta">
      <span>{{ t('pagination.item-count', {count: pageSize}) }}</span>
      <span class="page-range">{{ pageStart }}-{{ pageEnd }} / {{ total }}</span>
    </div>

    <div class="pager" aria-label="Pagination">
      <button type="button" :disabled="currentPage === 1" aria-label="Previous page" @click="goToPage(currentPage - 1)">
        <span class="material-icons" aria-hidden="true">chevron_left</span>
      </button>
      <template v-for="page in visiblePages" :key="page">
        <span v-if="typeof page === 'string'" class="pager-ellipsis" aria-hidden="true">...</span>
        <button
          v-else
          type="button"
          :class="{active: currentPage === page}"
          :aria-current="currentPage === page ? 'page' : undefined"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
      </template>
      <button type="button" :disabled="currentPage === pageCount" aria-label="Next page" @click="goToPage(currentPage + 1)">
        <span class="material-icons" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  </footer>
</template>

<style scoped>
.table-pagination {
  align-items: center;
  border-top: 0.5px solid #ececec;
  color: #757575;
  display: flex;
  font:
    400 12px/14px 'Varela Round',
    Arial,
    sans-serif;
  gap: 16px;
  justify-content: space-between;
  margin-top: 18px;
  overflow: hidden;
  padding-top: 18px;
}

.footer-meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  flex: 0 0 auto;
  gap: 10px;
  white-space: nowrap;
}

.page-range {
  color: #98a2b3;
}

.pager {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 6px;
  justify-content: flex-end;
  min-width: 0;
}

.pager button {
  align-items: center;
  background: #ffffff;
  border: 1px solid #ebeef2;
  border-radius: 8px;
  color: #4a4a4a;
  cursor: pointer;
  display: inline-flex;
  flex: 0 0 auto;
  height: 30px;
  justify-content: center;
  min-width: 30px;
  padding: 0 8px;
}

.pager button.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.pager button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.pager-ellipsis {
  color: #98a2b3;
  display: inline-flex;
  flex: 0 0 auto;
  font-weight: 800;
  justify-content: center;
  min-width: 18px;
}

.pager .material-icons {
  font-size: 16px;
  height: 16px;
  line-height: 16px;
  width: 16px;
}

@media (max-width: 900px) {
  .table-pagination {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
    overflow: visible;
  }

  .footer-meta {
    white-space: normal;
  }

  .pager {
    justify-content: flex-start;
  }
}
</style>
