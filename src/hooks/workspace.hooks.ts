import { Project, Tree } from '@/interfaces/workspace.interface';
import { workspaceState } from '@/state/workspace.state';
import cloneDeep from 'lodash.clonedeep';
import { useRecoilState } from 'recoil';

export { useWorkspaceActions };

function useWorkspaceActions() {
  const [workspace, updateWorkspace] = useRecoilState(workspaceState);

  return {
    createNewProject,
    projects,
    projectFiles,
    openFile,
    renameItem,
    openedFiles,
    closeFile,
    closeAllFile,
  };

  function updateStateByKey(dataByKey: any) {
    updateWorkspace((oldState) => {
      return {
        ...oldState,
        ...(dataByKey as any),
      };
    });
  }

  function createNewProject(project: Project, template: Tree[]) {
    updateStateByKey({
      projects: [...workspace.projects, project],
      projectFiles: { ...workspace.projectFiles, [project.id]: template },
    });
  }

  function projects() {
    return workspace.projects || [];
  }

  function projectFiles(projectId: string) {
    return workspace?.projectFiles?.[projectId] || [];
  }

  function updateProjectFiles(project: Tree[], projectId: string) {
    updateStateByKey({
      projectFiles: { ...workspace.projectFiles, [projectId]: project },
    });
  }

  function getFile(id: Tree['id'], projectId: string) {
    return projectFiles(projectId)?.find((item) => item.id == id);
  }

  function openFile(id: Tree['id'], projectId: string) {
    const openFiles = openedFiles().map((item) => {
      return {
        ...item,
        isOpen: false,
      };
    });

    const currentFile = getFile(id, projectId);
    if (!currentFile) {
      return;
    }

    const isAlreadyOpend = openFiles.find((item) => item.id === id);
    if (isAlreadyOpend) {
      isAlreadyOpend.isOpen = true;
    } else {
      const fileData = {
        id: currentFile?.id,
        name: currentFile?.name,
      };
      openFiles.push({ ...((fileData as any) || {}), isOpen: true });
    }
    updateStateByKey({ openFiles });
  }

  function openedFiles() {
    return workspace.openFiles;
  }

  function closeFile(id: string) {
    let openFiles = workspace.openFiles.filter((item) => item.id !== id);
    openFiles = openFiles.map((item) => {
      return {
        ...item,
        isOpen: false,
      };
    });
    if (openFiles.length > 0) {
      openFiles[openFiles.length - 1].isOpen = true;
    }
    updateStateByKey({ openFiles });
  }

  function closeAllFile() {
    updateStateByKey({ openFiles: [] });
  }

  function renameItem(id: string, name: string, projectId: string) {
    const item = searchNode(id, projectId);
    if (!item.node) {
      return;
    }

    if (isFileExists(name, projectId, item.node.parent || '')) {
      return;
    }
    item.node.name = name;
    let newPath = name;
    let pathArray: any = item.node.path?.split('/');
    if (pathArray && pathArray?.length > 1) {
      pathArray = pathArray?.pop() || [];
      newPath = pathArray.toString() + '/' + name;
    }
    item.node.path = newPath;
    updateProjectFiles(item.project, projectId);
  }

  function isFileExists(
    name: string,
    projectId: string,
    parentId: string = ''
  ): boolean {
    // if same file already exists in same directory
    if (!parentId) {
      return (
        projectFiles(projectId).findIndex(
          (file) => file.parent == '0' && file.name === name
        ) >= 0
      );
    }
    return (
      projectFiles(projectId).findIndex(
        (file) => file.parent === parentId && file.name === name
      ) >= 0
    );
  }

  function searchNode(
    id: string,
    projectId: string,
    key: 'id' | 'parent' = 'id'
  ): { node: Tree | null; project: Tree[] } {
    let projectTemp = cloneDeep(projectFiles(projectId));
    const node = projectTemp.find((file) => file[key] === id);

    return { node: node || null, project: projectTemp };
  }
}
