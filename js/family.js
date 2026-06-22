/**
 * 家庭共享模块 - 模拟数据层
 * 
 * 当前使用 localStorage 模拟家庭共享功能。
 * 后续接入 Supabase 后，只需替换此文件中的实现，
 * 上层调用接口保持不变。
 * 
 * 版本: 1.0
 */

const FAMILY_STORAGE_KEY = 'family_data';

// ========================================
// 数据结构
// ========================================
/**
 * 家庭数据结构:
 * {
 *   id: string,
 *   name: string,
 *   inviteCode: string,
 *   createdAt: string,
 *   members: [
 *     {
 *       id: string,
 *       nickname: string,
 *       role: 'owner' | 'admin' | 'member' | 'viewer',
 *       joinedAt: string
 *     }
 *   ]
 * }
 */

// ========================================
// 内部工具
// ========================================
function _genId() {
  return 'fam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function _genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function _readFamily() {
  try {
    const data = localStorage.getItem(FAMILY_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function _writeFamily(family) {
  localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(family));
}

function _getCurrentUserId() {
  let userId = localStorage.getItem('current_user_id');
  if (!userId) {
    userId = 'user_' + Date.now();
    localStorage.setItem('current_user_id', userId);
  }
  return userId;
}

function _getCurrentUserNickname() {
  return localStorage.getItem('current_user_nickname') || '我';
}

// ========================================
// 公开 API
// ========================================

const Family = {
  /**
   * 获取当前家庭信息
   */
  getCurrent() {
    return _readFamily();
  },

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    const family = _readFamily();
    const userId = _getCurrentUserId();
    const nickname = _getCurrentUserNickname();

    if (family) {
      const member = family.members.find(m => m.id === userId);
      if (member) {
        return {
          id: userId,
          nickname: member.nickname,
          role: member.role,
          familyId: family.id,
          familyName: family.name
        };
      }
    }

    return {
      id: userId,
      nickname: nickname,
      role: null,
      familyId: null,
      familyName: null
    };
  },

  /**
   * 创建家庭
   * @param {string} name - 家庭名称
   * @param {string} ownerNickname - 创建者昵称
   */
  createFamily(name, ownerNickname) {
    if (_readFamily()) {
      return { success: false, message: '已在一个家庭中，请先退出当前家庭' };
    }

    const userId = _getCurrentUserId();
    const family = {
      id: _genId(),
      name: name.trim(),
      inviteCode: _genInviteCode(),
      createdAt: new Date().toISOString(),
      members: [
        {
          id: userId,
          nickname: ownerNickname.trim() || '创建者',
          role: 'owner',
          joinedAt: new Date().toISOString()
        }
      ]
    };

    _writeFamily(family);
    localStorage.setItem('current_user_nickname', ownerNickname.trim() || '创建者');
    return { success: true, family };
  },

  /**
   * 加入家庭（通过邀请码）
   * @param {string} inviteCode - 6位邀请码
   * @param {string} nickname - 自己的昵称
   */
  joinFamily(inviteCode, nickname) {
    if (_readFamily()) {
      return { success: false, message: '已在一个家庭中，请先退出当前家庭' };
    }

    // 模拟：检查邀请码是否有效
    // 在实际 Supabase 版本中，这里会查询数据库
    if (!inviteCode || inviteCode.length < 4) {
      return { success: false, message: '邀请码无效' };
    }

    const userId = _getCurrentUserId();
    
    // 模拟创建一个家庭（实际应该由后端验证）
    // 这里为了演示，用固定邀请码 "FAMILY" 可以加入演示家庭
    let family;
    if (inviteCode.toUpperCase() === 'FAMILY') {
      family = {
        id: _genId(),
        name: '演示家庭',
        inviteCode: 'FAMILY',
        createdAt: new Date().toISOString(),
        members: [
          {
            id: 'demo_owner',
            nickname: '张三',
            role: 'owner',
            joinedAt: new Date().toISOString()
          },
          {
            id: 'demo_admin',
            nickname: '李四',
            role: 'admin',
            joinedAt: new Date().toISOString()
          }
        ]
      };
    } else {
      // 用邀请码作为家庭名创建新家庭（模拟加入已有家庭）
      family = {
        id: _genId(),
        name: `家庭 (${inviteCode})`,
        inviteCode: inviteCode.toUpperCase(),
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1天前创建
        members: [
          {
            id: 'owner_' + Date.now(),
            nickname: '家庭创建者',
            role: 'owner',
            joinedAt: new Date(Date.now() - 86400000).toISOString()
          }
        ]
      };
    }

    // 添加当前用户
    family.members.push({
      id: userId,
      nickname: nickname.trim() || '新成员',
      role: 'member',
      joinedAt: new Date().toISOString()
    });

    _writeFamily(family);
    localStorage.setItem('current_user_nickname', nickname.trim() || '新成员');
    return { success: true, family };
  },

  /**
   * 退出家庭
   */
  leaveFamily() {
    const family = _readFamily();
    if (!family) {
      return { success: false, message: '未加入任何家庭' };
    }

    const userId = _getCurrentUserId();
    const member = family.members.find(m => m.id === userId);
    
    if (member && member.role === 'owner') {
      return { success: false, message: '创建者不能退出家庭，请先转让所有权或删除家庭' };
    }

    family.members = family.members.filter(m => m.id !== userId);
    
    if (family.members.length === 0) {
      localStorage.removeItem(FAMILY_STORAGE_KEY);
    } else {
      _writeFamily(family);
    }
    
    return { success: true };
  },

  /**
   * 删除家庭（仅创建者）
   */
  deleteFamily() {
    const family = _readFamily();
    if (!family) {
      return { success: false, message: '未加入任何家庭' };
    }

    const userId = _getCurrentUserId();
    const member = family.members.find(m => m.id === userId);
    
    if (!member || member.role !== 'owner') {
      return { success: false, message: '只有家庭创建者才能删除家庭' };
    }

    localStorage.removeItem(FAMILY_STORAGE_KEY);
    return { success: true };
  },

  /**
   * 获取家庭成员列表
   */
  getMembers() {
    const family = _readFamily();
    if (!family) return [];
    return family.members;
  },

  /**
   * 获取当前用户的邀请码
   */
  getInviteCode() {
    const family = _readFamily();
    if (!family) return null;
    
    const userId = _getCurrentUserId();
    const member = family.members.find(m => m.id === userId);
    
    // 只有 owner 和 admin 可以查看邀请码
    if (member && (member.role === 'owner' || member.role === 'admin')) {
      return family.inviteCode;
    }
    return null;
  },

  /**
   * 刷新邀请码（仅创建者）
   */
  refreshInviteCode() {
    const family = _readFamily();
    if (!family) {
      return { success: false, message: '未加入任何家庭' };
    }

    const userId = _getCurrentUserId();
    const member = family.members.find(m => m.id === userId);
    
    if (!member || member.role !== 'owner') {
      return { success: false, message: '只有家庭创建者才能刷新邀请码' };
    }

    family.inviteCode = _genInviteCode();
    _writeFamily(family);
    return { success: true, inviteCode: family.inviteCode };
  },

  /**
   * 修改成员角色（仅创建者）
   * @param {string} memberId
   * @param {string} newRole - 'admin' | 'member' | 'viewer'
   */
  setMemberRole(memberId, newRole) {
    const family = _readFamily();
    if (!family) {
      return { success: false, message: '未加入任何家庭' };
    }

    const userId = _getCurrentUserId();
    const currentMember = family.members.find(m => m.id === userId);
    
    if (!currentMember || currentMember.role !== 'owner') {
      return { success: false, message: '只有家庭创建者才能修改成员角色' };
    }

    const target = family.members.find(m => m.id === memberId);
    if (!target) {
      return { success: false, message: '成员不存在' };
    }

    if (target.role === 'owner') {
      return { success: false, message: '不能修改创建者的角色' };
    }

    if (!['admin', 'member', 'viewer'].includes(newRole)) {
      return { success: false, message: '无效的角色' };
    }

    target.role = newRole;
    _writeFamily(family);
    return { success: true };
  },

  /**
   * 移除成员（仅创建者/管理员）
   * @param {string} memberId
   */
  removeMember(memberId) {
    const family = _readFamily();
    if (!family) {
      return { success: false, message: '未加入任何家庭' };
    }

    const userId = _getCurrentUserId();
    const currentMember = family.members.find(m => m.id === userId);
    
    if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
      return { success: false, message: '没有权限移除成员' };
    }

    const target = family.members.find(m => m.id === memberId);
    if (!target) {
      return { success: false, message: '成员不存在' };
    }

    if (target.role === 'owner') {
      return { success: false, message: '不能移除创建者' };
    }

    // admin 不能移除其他 admin
    if (currentMember.role === 'admin' && target.role === 'admin') {
      return { success: false, message: '管理员不能移除其他管理员' };
    }

    family.members = family.members.filter(m => m.id !== memberId);
    _writeFamily(family);
    return { success: true };
  },

  /**
   * 检查当前用户是否有权限执行操作
   * @param {string} action - 'add' | 'edit' | 'delete' | 'view'
   */
  checkPermission(action) {
    const family = _readFamily();
    if (!family) return true; // 没有家庭时，允许所有操作（单人模式）

    const userId = _getCurrentUserId();
    const member = family.members.find(m => m.id === userId);
    
    if (!member) return false;

    const rolePermissions = {
      'owner': { add: true, edit: true, delete: true, view: true },
      'admin': { add: true, edit: true, delete: true, view: true },
      'member': { add: true, edit: true, delete: false, view: true },
      'viewer': { add: false, edit: false, delete: false, view: true }
    };

    const permissions = rolePermissions[member.role];
    return permissions ? permissions[action] : false;
  },

  /**
   * 获取当前用户角色文本
   */
  getRoleText(role) {
    const roleMap = {
      'owner': '创建者',
      'admin': '管理员',
      'member': '成员',
      'viewer': '仅查看'
    };
    return roleMap[role] || '未知';
  }
};
