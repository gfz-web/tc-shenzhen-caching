import type { POIData } from '~/types/amap'

/**
 * POI生成器 Composable
 * 用于开发者模式快速生成POI数据
 */
export function usePOIGenerator() {
  const { success, error } = useToast()
  // POI生成表单状态
  const newPOI = ref({
    name: '',
    description: '',
    rating: 1,
    category: '景点' as '山脉' | '景点' | '公园',
    position: null as { lng: number, lat: number } | null,
    referencePhoto: '',
    easter_egg: undefined as import('~/types/amap').EasterEgg | undefined,
  })

  const showAddForm = ref(false)
  const showEditForm = ref(false)
  const editingPOI = ref<POIData | null>(null)
  const addSuccess = ref(false)
  const editSuccess = ref(false)

  // POI分类选项
  const categoryOptions = ['山脉', '景点', '公园']

  /**
   * 生成随机ID - 使用Math.random转36进制截取
   */
  function generateRandomId(): string {
    return Math.random().toString(36).substring(2, 10)
  }

  /**
   * 显示错误信息
   */
  function showError(message: string) {
    error('操作失败', message)
  }

  /**
   * 显示成功信息
   */
  function showSuccess(message: string) {
    success('操作成功', message)
  }

  /**
   * 切换添加POI表单
   */
  function toggleAddForm(selectedPosition?: { lng: number, lat: number } | null) {
    showAddForm.value = !showAddForm.value
    // 如果打开添加表单，关闭编辑表单
    if (showAddForm.value) {
      showEditForm.value = false
      editingPOI.value = null
      // 重置表单
      newPOI.value = {
        name: '',
        description: '',
        rating: 1,
        category: '景点',
        position: selectedPosition || null,
        referencePhoto: '',
        easter_egg: undefined,
      }
    }
    else {
      addSuccess.value = false
    }
  }

  /**
   * 开始编辑POI
   */
  function startEditPOI(poi: POIData) {
    editingPOI.value = poi
    showEditForm.value = true
    showAddForm.value = false

    // 填充编辑表单
    newPOI.value = {
      name: poi.name,
      description: poi.description || '',
      rating: poi.rating || 1,
      category: poi.category as '山脉' | '景点' | '公园',
      position: poi.position ? { lng: poi.position[0], lat: poi.position[1] } : null,
      referencePhoto: poi.referencePhoto || '',
      easter_egg: poi.easter_egg,
    }

    // 清空提示信息
    addSuccess.value = false
    editSuccess.value = false
  }

  /**
   * 取消编辑
   */
  function cancelEdit() {
    showEditForm.value = false
    editingPOI.value = null
    editSuccess.value = false
  }

  /**
   * 使用选中的位置
   */
  function useSelectedPosition(position: { lng: number, lat: number } | null) {
    if (position) {
      newPOI.value.position = position
    }
  }

  /**
   * 设置POI位置（当地图选择位置时自动调用）
   */
  function setPOIPosition(position: { lng: number, lat: number }) {
    if (showAddForm.value) {
      newPOI.value.position = position
    }
  }

  /**
   * 更新POI数据
   */
  async function updatePOI(updatePOIFn?: (id: string, poiData: Partial<POIData>) => Promise<POIData>, onSuccess?: () => void): Promise<POIData | null> {
    if (!editingPOI.value) {
      showError('没有正在编辑的POI')
      return null
    }

    // 验证表单
    if (!newPOI.value.name || !newPOI.value.name.trim()) {
      showError('请输入POI名称')
      return null
    }

    if (!newPOI.value.position) {
      showError('请选择位置')
      return null
    }

    try {
      // 创建更新数据对象
      const updateData: Partial<POIData> = {
        name: newPOI.value.name.trim(),
        description: newPOI.value.description.trim(),
        rating: newPOI.value.rating,
        position: [newPOI.value.position.lng, newPOI.value.position.lat],
        category: newPOI.value.category,
        referencePhoto: newPOI.value.referencePhoto.trim(),
        easter_egg: newPOI.value.easter_egg,
      }

      // 如果提供了更新函数，则调用API更新
      if (updatePOIFn) {
        const updatedPOI = await updatePOIFn(editingPOI.value.id, updateData)

        // 显示成功提示
        editSuccess.value = true
        showSuccess('POI已成功更新')

        // 调用成功回调
        if (onSuccess) {
          onSuccess()
        }

        // 延迟关闭表单让用户看到成功提示
        setTimeout(() => {
          showEditForm.value = false
          editSuccess.value = false
          editingPOI.value = null
          resetForm()
        }, 2000)

        return updatedPOI
      }
      else {
        // 如果没有更新函数，显示错误
        showError('没有提供更新函数')
        return null
      }
    }
    catch (error) {
      console.error('更新POI失败:', error)
      showError(`更新POI失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return null
    }
  }

  /**
   * 生成并保存新POI数据
   */
  async function generatePOI(addPOIFn?: (poiData: Omit<POIData, 'id'>) => Promise<POIData>, onSuccess?: () => void): Promise<POIData | null> {
    // 验证表单
    if (!newPOI.value.name || !newPOI.value.name.trim()) {
      showError('请输入POI名称')
      return null
    }

    if (!newPOI.value.position) {
      showError('请选择位置')
      return null
    }

    try {
      // 创建新POI对象
      const newPOIData: Omit<POIData, 'id'> = {
        name: newPOI.value.name.trim(),
        description: newPOI.value.description.trim(),
        rating: newPOI.value.rating,
        position: [newPOI.value.position.lng, newPOI.value.position.lat],
        category: newPOI.value.category,
        referencePhoto: newPOI.value.referencePhoto.trim(),
        easter_egg: newPOI.value.easter_egg,
      }

      // 如果提供了添加函数，则调用API保存
      if (addPOIFn) {
        const savedPOI = await addPOIFn(newPOIData)

        // 显示成功提示
        addSuccess.value = true
        showSuccess('POI已成功保存到数据库')

        // 重置表单
        resetForm()

        // 调用成功回调
        if (onSuccess) {
          onSuccess()
        }

        // 延迟关闭表单让用户看到成功提示
        setTimeout(() => {
          showAddForm.value = false
          addSuccess.value = false
        }, 2000)

        return savedPOI
      }
      else {
        // 降级到复制到剪贴板的方式
        const jsonString = JSON.stringify({ id: generateRandomId(), ...newPOIData }, null, 2)
        await navigator.clipboard.writeText(jsonString)

        // 显示成功提示
        addSuccess.value = true
        showSuccess('POI数据已生成并复制到剪贴板')

        // 重置表单
        resetForm()

        // 3秒后隐藏成功提示
        setTimeout(() => {
          addSuccess.value = false
        }, 3000)

        return { id: generateRandomId(), ...newPOIData }
      }
    }
    catch (error) {
      console.error('保存POI失败:', error)
      showError(`保存POI失败: ${error instanceof Error ? error.message : '未知错误'}`)
      return null
    }
  }

  /**
   * 重置表单
   */
  function resetForm() {
    newPOI.value = {
      name: '',
      description: '',
      rating: 3,
      category: '景点',
      position: null,
      referencePhoto: '',
      easter_egg: undefined,
    }
    addSuccess.value = false
    editSuccess.value = false
  }

  return {
    // 状态 - newPOI需要可写以支持表单绑定
    newPOI,
    showAddForm: readonly(showAddForm),
    showEditForm: readonly(showEditForm),
    editingPOI: readonly(editingPOI),
    addSuccess: readonly(addSuccess),
    editSuccess: readonly(editSuccess),
    categoryOptions,

    // 方法
    generateRandomId,
    toggleAddForm,
    startEditPOI,
    cancelEdit,
    useSelectedPosition,
    setPOIPosition,
    generatePOI,
    updatePOI,
    resetForm,
    showError,
    showSuccess,
  }
}
